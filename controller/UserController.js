const bcrypt = require('bcrypt');
const User = require('../model/User'); 
const Transaction = require('../model/Transaction');
const Budjet = require('../model/Budget');
const Auth = require('./Auth');
const Wallet = require('../model/Wallet');
const mongoose = require('mongoose')



const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('AIzaSyC2vA5DNw-g9jYGlRqomFKJQUrvw9q--Zo');

const generatePredictions = (transactions) => {
  const next30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  // Calculate average daily expenses and income for each day of the week
  const expensesByDay = {};
  const incomeByDay = {};
  
  // Group transactions by day of week and calculate total
  transactions.forEach(transaction => {
    const dayOfWeek = new Date(transaction.date).getDay();
    if (transaction.type === 'expense') {
      expensesByDay[dayOfWeek] = (expensesByDay[dayOfWeek] || 0) + transaction.amount;
    } else {
      incomeByDay[dayOfWeek] = (incomeByDay[dayOfWeek] || 0) + transaction.amount;
    }
  });

  // Generate predictions for next 30 days
  return next30Days.map(date => {
    const dayOfWeek = new Date(date).getDay();
    return {
      date,
      predictedExpenses: Math.round((expensesByDay[dayOfWeek] || 0) / 12), // Divide by approximately 12 weeks
      predictedIncome: Math.round((incomeByDay[dayOfWeek] || 0) / 12)
    };
  });
};

// Helper function to get AI-powered predictions and insights
async function getAIPredictionsAndInsights(transactions, categoryAnalysis, budgetStatus) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  // Prepare data for AI analysis with 30 days of context
  const financialContext = {
    transactionHistory: transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      category: t.category.name,
      date: t.date
    })),
    categoryPerformance: categoryAnalysis,
    budgetUtilization: budgetStatus,
    analysisTimeframe: "Last 30 Days"
  };

  // Updated prompt to emphasize 30-day analysis and enforce structure
  const prompt = `
    Provide a comprehensive 30-day financial analysis as a financial advisor. 
    Return the analysis in strict JSON format without any markdown formatting or code blocks.
    Focus on a detailed 30-day financial overview.

    Transaction History: ${JSON.stringify(financialContext.transactionHistory)}
    Category Performance: ${JSON.stringify(financialContext.categoryPerformance)}
    Budget Status: ${JSON.stringify(financialContext.budgetUtilization)}

    In your JSON response, ONLY use these exact field names:
    - spendingPatterns: Array of objects with {pattern: string}
    - budgetRecommendations: Array of objects with {recommendation: string}
    - savingsOpportunities: Array of objects with {opportunity: string, potentialSavings: number}
    - incomeGrowth: Array of objects with {strategy: string, potentialIncrease: number}
    - riskAssessment: Array of objects with {risk: string, severity: string, mitigation: string}
    - confidenceScore: Numerical confidence in the analysis (0-1)
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text();
    
    // Clean up the response text to ensure valid JSON
    responseText = responseText.replace(/```json\s*|\s*```/g, '');
    responseText = responseText.trim();
    
    try {
      const aiInsights = JSON.parse(responseText);
      
      // Create a standardized response with default empty arrays for missing fields
      return {
        aiPredictions: {
          spendingPatterns: formatPatterns(aiInsights.spendingPatterns),
          budgetRecommendations: formatRecommendations(aiInsights.budgetRecommendations),
          savingsOpportunities: formatSavings(aiInsights.savingsOpportunities),
          incomeGrowth: formatIncome(aiInsights.incomeGrowth),
          riskAssessment: formatRisks(aiInsights.riskAssessment)
        },
        confidenceScore: aiInsights.confidenceScore || 0.8
      };
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return getDefaultAIResponse("30-day analysis unavailable due to parsing error");
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return getDefaultAIResponse("AI service unavailable");
  }
}

// Helper functions to standardize the AI response structure
function formatPatterns(patterns) {
  if (!patterns || !Array.isArray(patterns)) return [{ pattern: "No spending patterns identified" }];
  return patterns.map(p => {
    if (typeof p === 'string') return { pattern: p };
    return { pattern: p.pattern || p.description || p.text || "Unspecified pattern" };
  });
}

function formatRecommendations(recommendations) {
  if (!recommendations || !Array.isArray(recommendations)) return [{ recommendation: "No budget recommendations available" }];
  return recommendations.map(r => {
    if (typeof r === 'string') return { recommendation: r };
    return { recommendation: r.recommendation || r.suggestion || r.advice || r.text || "Unspecified recommendation" };
  });
}

function formatSavings(savings) {
  if (!savings || !Array.isArray(savings)) return [{ opportunity: "No savings opportunities identified", potentialSavings: 0 }];
  return savings.map(s => {
    if (typeof s === 'string') return { opportunity: s, potentialSavings: 0 };
    return { 
      opportunity: s.opportunity || s.suggestion || s.description || s.text || "Unspecified opportunity", 
      potentialSavings: s.potentialSavings || s.savings || s.amount || 0 
    };
  });
}

function formatIncome(income) {
  if (!income || !Array.isArray(income)) return [{ strategy: "No income growth strategies identified", potentialIncrease: 0 }];
  return income.map(i => {
    if (typeof i === 'string') return { strategy: i, potentialIncrease: 0 };
    return { 
      strategy: i.strategy || i.opportunity || i.suggestion || i.description || i.text || "Unspecified strategy", 
      potentialIncrease: i.potentialIncrease || i.increase || i.amount || 0 
    };
  });
}

function formatRisks(risks) {
  if (!risks || !Array.isArray(risks)) return [{ risk: "No financial risks identified", severity: "low", mitigation: "Continue monitoring your finances" }];
  return risks.map(r => {
    if (typeof r === 'string') return { risk: r, severity: "medium", mitigation: "Monitor this risk" };
    return { 
      risk: r.risk || r.description || r.issue || r.text || "Unspecified risk", 
      severity: r.severity || "medium", 
      mitigation: r.mitigation || r.solution || r.action || "Monitor this risk" 
    };
  });
}

function getDefaultAIResponse(message) {
  return {
    aiPredictions: {
      spendingPatterns: [{ pattern: message }],
      budgetRecommendations: [{ recommendation: "Set budgets for your major spending categories" }],
      savingsOpportunities: [{ opportunity: "Review your recurring subscriptions", potentialSavings: 0 }],
      incomeGrowth: [{ strategy: "Consider diversifying your income sources", potentialIncrease: 0 }],
      riskAssessment: [{ risk: "Limited financial data available", severity: "medium", mitigation: "Continue tracking your finances" }]
    },
    confidenceScore: 0
  };
}

// Helper function to analyze overspending
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

// Helper function to generate savings recommendations
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

// Helper function to analyze income opportunities
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

// Helper function to generate risk analysis
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

// Main financial analysis controller
exports.getAIFinancialAnalysis = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Fetch transactions for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: thirtyDaysAgo }
    }).populate('category');

    // Fetch user's budget
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

    // Process category analysis
    const processedCategoryAnalysis = Object.entries(categoryAnalysis).map(([category, data]) => ({
      category,
      totalSpent: data.total,
      transactionCount: data.count,
      averagePerTransaction: data.total / data.count,
      type: data.type
    }));

    // Process budget status
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
      aiInsights: aiAnalysis
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
    // Get data for the last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Find transactions for the user in the last 30 days
    const transactions = await Transaction.find({
      user: userId,
      date: { 
        $gte: thirtyDaysAgo, 
        $lte: today 
      }
    }).populate('category').sort({ date: 1 });

    // Find user's wallet
    const wallet = await Wallet.findOne({ user: userId });

    // Prepare data containers
    let expenseCategories = [];
    let incomeCategories = [];
    let categorySummary = {
      expenses: [],
      income: []
    };
    let balanceTrend = [];
    let totalIncome = 0;
    let totalExpense = 0;

    // Create precise week boundaries
    const weekBoundaries = [
      {
        start: new Date(thirtyDaysAgo),
        end: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 6)),
        week: "1"
      },
      {
        start: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 7)),
        end: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 13)),
        week: "2"
      },
      {
        start: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 14)),
        end: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 20)),
        week: "3"
      },
      {
        start: new Date(new Date(thirtyDaysAgo).setDate(thirtyDaysAgo.getDate() + 21)),
        end: today,
        week: "4"
      }
    ];

    // Prepare category summaries
    const expenseSummary = {};
    const incomeSummary = {};

    // Process transactions
    transactions.forEach(txn => {
      const categoryId = txn.category._id.toString();
      const categoryName = txn.category.name;
      const categoryIcon = txn.category.icon;
      const categoryColor = txn.category.color;

      // Original expense and income categories
      if (txn.type === "expense") {
        totalExpense += txn.amount;
        expenseCategories.push({
          user: txn.user,
          type: txn.type,
          amount: txn.amount,
          category: txn.category._id,
          date: txn.date
        });

        // Category summary for expenses
        if (!expenseSummary[categoryId]) {
          expenseSummary[categoryId] = {
            name: categoryName,
            icon: categoryIcon,
            color: categoryColor,
            totalAmount: 0,
            transactionCount: 0,
            transactions: []
          };
        }
        expenseSummary[categoryId].totalAmount += txn.amount;
        expenseSummary[categoryId].transactionCount++;
        expenseSummary[categoryId].transactions.push({
          date: txn.date,
          amount: txn.amount
        });
      } else if (txn.type === "income") {
        totalIncome += txn.amount;
        incomeCategories.push({
          user: txn.user,
          type: txn.type,
          amount: txn.amount,
          category: txn.category._id,
          date: txn.date
        });

        // Category summary for income
        if (!incomeSummary[categoryId]) {
          incomeSummary[categoryId] = {
            name: categoryName,
            icon: categoryIcon,
            color: categoryColor,
            totalAmount: 0,
            transactionCount: 0,
            transactions: []
          };
        }
        incomeSummary[categoryId].totalAmount += txn.amount;
        incomeSummary[categoryId].transactionCount++;
        incomeSummary[categoryId].transactions.push({
          date: txn.date,
          amount: txn.amount
        });
      }
    });

    // Convert to array and sort by total amount (descending)
    categorySummary.expenses = Object.values(expenseSummary)
      .sort((a, b) => b.totalAmount - a.totalAmount);
    
    categorySummary.income = Object.values(incomeSummary)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate balance trend
    let runningBalance = wallet ? wallet.balance : 0;
    const initialBalance = runningBalance;
    
    // First balance trend entry
    balanceTrend.push({
      date: thirtyDaysAgo.toISOString().split('T')[0],
      week: "0",
      balance: initialBalance
    });

    // Calculate balance for each week boundary
    weekBoundaries.forEach(boundary => {
      const weekTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= boundary.start && txnDate <= boundary.end;
      });

      weekTransactions.forEach(txn => {
        runningBalance += txn.type === "income" ? txn.amount : -txn.amount;
      });

      balanceTrend.push({
        date: boundary.end.toISOString().split('T')[0],
        week: boundary.week,
        balance: runningBalance
      });
    });

    // Prepare final response
    const formattedData = {
      expenseCategories,
      incomeCategories,
      categorySummary,
      balanceTrend,
      summary: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        startingBalance: initialBalance,
        endingBalance: runningBalance,
        period: {
          start: thirtyDaysAgo,
          end: today,
          weeks: 4
        }
      }
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error getting transaction data:', error);
    res.status(500).json({ 
      error: `Error getting transaction data: ${error.message}`,
      details: error.toString() 
    });
  }
};