const bcrypt = require('bcrypt');
const User = require('../model/User'); 
const Transaction = require('../model/Transaction');
const Budjet = require('../model/Budget');
const Auth = require('./Auth');
const Wallet = require('../model/Wallet');
const mongoose = require('mongoose')



const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('');

const generatePredictions = (transactions) => {
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  // Calculate average daily expenses and income
  const expensesByDay = {};
  const incomeByDay = {};
  
  transactions.forEach(transaction => {
    const dayOfWeek = new Date(transaction.date).getDay();
    if (transaction.type === 'expense') {
      expensesByDay[dayOfWeek] = (expensesByDay[dayOfWeek] || 0) + transaction.amount;
    } else {
      incomeByDay[dayOfWeek] = (incomeByDay[dayOfWeek] || 0) + transaction.amount;
    }
  });

  return next7Days.map(date => {
    const dayOfWeek = new Date(date).getDay();
    return {
      date,
      predictedExpenses: Math.round((expensesByDay[dayOfWeek] || 0) / 4), // Divide by 4 weeks
      predictedIncome: Math.round((incomeByDay[dayOfWeek] || 0) / 4)
    };
  });
};

// Helper function to generate AI-powered predictions and insights
async function getAIPredictionsAndInsights(transactions, categoryAnalysis, budgetStatus) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  // Prepare data for AI analysis
  const financialContext = {
    transactionHistory: transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      category: t.category.name,
      date: t.date
    })),
    categoryPerformance: categoryAnalysis,
    budgetUtilization: budgetStatus
  };

  // Generate prompt for AI analysis
  const prompt = `
    As a financial advisor, analyze this financial data and provide insights. 
    Return the analysis in strict JSON format without any markdown formatting or code blocks.
    Here's the data to analyze:

    Transaction History: ${JSON.stringify(financialContext.transactionHistory)}
    Category Performance: ${JSON.stringify(financialContext.categoryPerformance)}
    Budget Status: ${JSON.stringify(financialContext.budgetUtilization)}

    Provide the following in your JSON response:
    - spendingPatterns: Array of identified spending patterns
    - budgetRecommendations: Array of specific recommendations
    - savingsOpportunities: Array of potential savings
    - incomeGrowth: Array of income improvement suggestions
    - riskAssessment: Array of identified risks
    - confidenceScore: Number between 0 and 1
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();
    
    // Clean up the response text to ensure valid JSON
    responseText = responseText.replace(/```json\s*|\s*```/g, ''); // Remove any markdown code blocks
    responseText = responseText.trim();
    
    // Attempt to parse the cleaned response
    try {
      const aiInsights = JSON.parse(responseText);
      return {
        aiPredictions: {
          spendingPatterns: aiInsights.spendingPatterns || [],
          budgetRecommendations: aiInsights.budgetRecommendations || [],
          savingsOpportunities: aiInsights.savingsOpportunities || [],
          incomeGrowth: aiInsights.incomeGrowth || [],
          riskAssessment: aiInsights.riskAssessment || []
        },
        confidenceScore: aiInsights.confidenceScore || 0.8
      };
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      // Provide fallback analysis if parsing fails
      return {
        aiPredictions: {
          spendingPatterns: [{pattern: "Analysis unavailable due to parsing error"}],
          budgetRecommendations: [],
          savingsOpportunities: [],
          incomeGrowth: [],
          riskAssessment: []
        },
        confidenceScore: 0
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return null;
  }
}

// Keep existing helper functions
const analyzeOverspending = (categoryAnalysis, budgetStatus) => {
  const overspending = [];
  
  categoryAnalysis.forEach(category => {
    const budget = budgetStatus.find(b => b.name === category.category);
    if (budget && category.totalSpent > budget.limit * 0.8) {
      overspending.push({
        category: category.category,
        amount: category.totalSpent,
        recommendation: category.totalSpent > budget.limit ?
          `You have exceeded your budget for ${category.category}. Consider reducing expenses in this category.` :
          `You are close to your budget limit for ${category.category}. Monitor spending carefully.`
      });
    }
  });

  return overspending;
};

const generateSavingsRecommendations = (categoryAnalysis) => {
  const recommendations = [];
  
  categoryAnalysis.forEach(category => {
    if (category.type === 'expense') {
      if (category.averagePerTransaction > 500) {
        recommendations.push({
          suggestion: `Consider reducing ${category.category} expenses. Your average transaction is $${category.averagePerTransaction.toFixed(2)}.`,
          potentialSavings: Math.round(category.averagePerTransaction * 0.2)
        });
      }
      if (category.transactionCount > 3) {
        recommendations.push({
          suggestion: `You have frequent ${category.category} transactions. Consider consolidating to reduce overall spending.`,
          potentialSavings: Math.round(category.totalSpent * 0.1)
        });
      }
    }
  });

  return recommendations;
};

const analyzeIncomeOpportunities = (categoryAnalysis) => {
  const opportunities = [];
  
  const incomeCategories = categoryAnalysis.filter(cat => 
    ['Freelancing', 'Business', 'Rental Income', 'Investment', 'Salary', 'Pension', 'Gifts', 'Other Income'].includes(cat.category)
  );

  incomeCategories.forEach(category => {
    opportunities.push({
      opportunity: `Increase ${category.category} revenue by seeking more clients or optimizing pricing`,
      potentialIncrease: Math.round(category.totalSpent * 0.25)
    });
  });

  return opportunities;
};

const generateRiskAnalysis = (categoryAnalysis, budgetStatus) => {
  const risks = [];
  
  budgetStatus.forEach(budget => {
    const utilizationRate = (budget.spent / budget.limit) * 100;
    if (utilizationRate > 90) {
      risks.push({
        risk: `High budget utilization in ${budget.name}`,
        severity: "high",
        mitigation: "Review and adjust budget allocation or reduce spending"
      });
    }
  });

  const incomeCategories = categoryAnalysis.filter(cat => 
    ['Freelancing', 'Business', 'Rental Income', 'Investment', 'Salary', 'Pension', 'Gifts', 'Other Income'].includes(cat.category)
  );
  
  if (incomeCategories.length < 2) {
    risks.push({
      risk: "Limited income diversification",
      severity: "medium",
      mitigation: "Consider developing additional income streams"
    });
  }

  return risks;
};

// Main analysis function
exports.getAIFinancialAnalysis = async (req, res) => {
  try {
    const userId = req.params.userId;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: threeMonthsAgo }
    }).populate('category');

    const budget = await Budjet.findOne({
      user: userId
    }).populate('categories.category');

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: 'No budget found for user'
      });
    }

    // Process categories
    const categoryAnalysis = transactions.reduce((acc, transaction) => {
      const category = transaction.category.name;
      if (!acc[category]) {
        acc[category] = {
          total: 0,
          count: 0,
          type: transaction.type,
          transactions: []
        };
      }
      acc[category].total += transaction.amount;
      acc[category].count += 1;
      acc[category].transactions.push({
        amount: transaction.amount,
        date: transaction.date
      });
      return acc;
    }, {});

    const processedCategoryAnalysis = Object.entries(categoryAnalysis).map(([category, data]) => ({
      category,
      totalSpent: data.total,
      transactionCount: data.count,
      averagePerTransaction: data.total / data.count,
      type: data.type
    }));

    const budgetStatus = budget.categories.map(cat => ({
      name: cat.name,
      limit: cat.limit,
      spent: cat.spent,
      remaining: cat.limit - cat.spent
    }));

    // Get AI-powered insights
    const aiAnalysis = await getAIPredictionsAndInsights(
      transactions,
      processedCategoryAnalysis,
      budgetStatus
    );

    // Combine traditional analysis with AI insights
    const analysis = {
      historicalData: {
        categoryAnalysis: processedCategoryAnalysis,
        budgetStatus
      },
      predictions: generatePredictions(transactions),
      insights: {
        overspending: analyzeOverspending(processedCategoryAnalysis, budgetStatus),
        savings: generateSavingsRecommendations(processedCategoryAnalysis),
        income: analyzeIncomeOpportunities(processedCategoryAnalysis),
        risks: generateRiskAnalysis(processedCategoryAnalysis, budgetStatus)
      },
      aiInsights: aiAnalysis || {
        message: "AI analysis unavailable, falling back to traditional analysis"
      }
    };

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Financial analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate financial analysis',
      details: error.message
    });
  }
};


exports.createUser = async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({ name, email, password: hashedPassword, phone });

        await user.save();
        const isWallet = await Wallet.findOne({ userId: user._id });
        if (!isWallet) {
            const wallet = new Wallet({ user: user._id });
            await wallet.save();
        }
        const isBudjet = await Budjet.findOne({ user: user._id });
        if (!isBudjet) {
            const budjet = new Budjet({ user: user._id });
            await budjet.save();
        }
        res.status(201).json({ message: 'User created successfully', Data : user });
    } catch (e) {
        res.status(500).send(e);
        console.log(e);
    }
};

exports.login = async (req, res) => {
    console.log("Login Request Body:", req.body); // Log incoming request body
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            console.log("User not found");
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("Invalid password");
            return res.status(400).json({ message: "Invalid email or password" });
        }
           console.log("User logged in successfully");
        const token = Auth.generateToken(user._id, user.email);
        console.log("Token:", token);
        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};


exports.getUserData = async (req, res) => {
    const {id, email} = req.user;
    try{
        const user = await User.findById(id).select('-password');
        if(!user){
            return res.status(404).send('User not found');
        }
        const budjet = await Budjet.find({user : user._id}).populate('categories.category');
        const transaction = await Transaction.find({user : user._id}).populate('category')
        const wallet = await Wallet.find({user : user._id});
res.status(200).json({user, budjet, transaction, wallet});
    }catch(e){
        res.status(500).send(e);
    }
}


exports.getUserTransactionData = async (req, res) => {
    const { userId } = req.params;
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const transactions = await Transaction.find({
            user: userId,
            date: { $gte: sevenDaysAgo }
        }).populate('category');

        const wallet = await Wallet.findOne({ user: userId });

        let expenseCategories = [];
        let incomeCategories = [];
        let weeklyData = {};
        let balanceTrend = [];
        let totalIncome = 0;
        let totalExpense = 0;

        // Sort transactions by date (ascending)
        const sortedTransactions = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Process transactions for categories and weekly data
        sortedTransactions.forEach(txn => {
            const formattedDate = txn.date.toISOString().split('T')[0];
            const day = txn.date.toLocaleDateString('en-US', { weekday: 'short' });

            if (txn.type === "expense") {
                totalExpense += txn.amount;
                expenseCategories.push({
                    user: txn.user,
                    type: txn.type,
                    amount: txn.amount,
                    category: txn.category._id,
                    date: txn.date,
                    note: txn.note
                });
            } else if (txn.type === "income") {
                totalIncome += txn.amount;
                incomeCategories.push({
                    user: txn.user,
                    type: txn.type,
                    amount: txn.amount,
                    category: txn.category._id,
                    date: txn.date,
                    note: txn.note
                });
            }

            if (!weeklyData[formattedDate]) {
                weeklyData[formattedDate] = { date: formattedDate, day, transactions: [] };
            }
            weeklyData[formattedDate].transactions.push({
                user: txn.user,
                type: txn.type,
                amount: txn.amount,
                category: txn.category._id,
                date: txn.date,
                note: txn.note
            });
        });

        // Sort weekly data
        const sortedWeeklyData = Object.values(weeklyData).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        // Calculate starting balance (current balance minus all transactions)
        let startingBalance = wallet ? wallet.balance : 0;
        sortedTransactions.forEach(txn => {
            startingBalance -= txn.type === "income" ? txn.amount : -txn.amount;
        });

        // Generate balance trend starting from the initial balance
        let runningBalance = startingBalance;
        balanceTrend = sortedWeeklyData.map(day => {
            day.transactions.forEach(txn => {
                runningBalance += txn.type === "income" ? txn.amount : -txn.amount;
            });
            return {
                date: day.date,
                balance: runningBalance
            };
        });

        // Add starting balance as first point if there are transactions
        if (balanceTrend.length > 0) {
            balanceTrend.unshift({
                date: sevenDaysAgo.toISOString().split('T')[0],
                balance: startingBalance
            });
        }

        const formattedData = {
            expenseCategories,
            incomeCategories,
            weeklyData: sortedWeeklyData,
            balanceTrend,
            summary: {
                totalIncome,
                totalExpense,
                netBalance: totalIncome - totalExpense,
                startingBalance,
                endingBalance: wallet ? wallet.balance : 0,
            }
        };

        res.json(formattedData);
    } catch (error) {
        res.status(500).json({ error: `Error getting transaction data: ${error.message}` });
    }
};

function getDefaultColor(index) {
  const colors = [
    '#FF8A65', '#FFB74D', '#4DD0E1', '#81C784', 
    '#64B5F6', '#BA68C8', '#A1887F', '#90A4AE'
  ];
  return colors[index % colors.length];
}




const data = {
  predictions : {
    general : [
      {
        category: "Salary",
        amount: 5000,
        date: "2023-10-01"
      },
      {
        category: "Investment",
        amount: 2000,
        date: "2023-10-02"
      },
      {
        category: "Gift",
        amount: 1000,
         date: "2023-10-03"
      },
      {
        category: "Rent",
        amount: 1000,
        date: "2023-10-01"
      },
      {
        category: "Utilities",
        amount: 500,
        date: "2023-10-02"
      },
      {
        category: "Groceries",
        amount: 300,
        date: "2023-10-03"
      }
    ],
    income : [
      {
        category: "Salary",
        amount: 5000,
        date: "2023-10-01"
      },
      {
        category: "Investment",
        amount: 2000,
        date: "2023-10-02"
      },
      {
        category: "Gift",
        amount: 1000,
         date: "2023-10-03"
      }
    ],
expence : [
      {
        category: "Rent",
        amount: 1000,
        date: "2023-10-01"
      },
      {
        category: "Utilities",
        amount: 500,
        date: "2023-10-02"
      },
      {
        category: "Groceries",
        amount: 300,
        date: "2023-10-03"
      }
]
  },
  suggestions : {
    IncreaseIncome : [
      'You asldjkwsafjd aspjaspodasd ',
      'adkaskld aposdu azsjd asdoj asd',
      "oasjdf poasjd poajsdfp asdf"
    ],
   IncreaseSavings : [
      'You asldjkwsafjd aspjaspodasd ',
      'adkaskld aposdu azsjd asdoj asd',
      "oasjdf poasjd poajsdfp asdf"
   ],

  }
}