const User = require('../model/User');
const Transaction = require('../model/Transaction');
const Wallet = require('../model/Wallet');
const Budget = require('../model/Budget');
exports.createTransaction = async (req, res) => {
    try {
        console.log("Request Body:", req.body);
        console.log("User ID:", req.user.id);

        const { type, amount, category, date, note } = req.body;
        const { id } = req.user;

        if (!type || !amount || !category || !date) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const isUser = await User.findById(id);
        if (!isUser) {
            console.log("User not found!");
            return res.status(404).json({ message: 'User not found' });
        }

        const transaction = new Transaction({
            user: id,
            type,
            amount: Number(amount),
            category,
            date: new Date(date),
            note
        });

        await transaction.save();
        console.log("Transaction saved:", transaction);

        const wallet = await Wallet.findOne({ user: id });
        if (!wallet) {
            console.log("Wallet not found!");
            return res.status(404).json({ message: "Wallet not found" });
        }

        if (type === 'income') {
            wallet.balance += Number(amount);
        } else if (type === 'expense') {
            wallet.balance -= Number(amount);
        }

        await wallet.save();
        console.log("Wallet updated:", wallet.balance);

        if (type === 'expense') {
            const budget = await Budget.findOne({
                user: id,
                "categories.category": category
            });

            if (budget) {
                console.log("Budget found:", budget);
                
                const categoryIndex = budget.categories.findIndex(
                    cat => cat.category.toString() === category.toString()
                );

                if (categoryIndex !== -1) {
                    const budgetCategory = budget.categories[categoryIndex];
                    const transactionDate = new Date(date);
                    const endDate = new Date(budgetCategory.endDate);

                    console.log('Transaction Date:', transactionDate);
                    console.log('Budget End Date:', endDate);

                    if (transactionDate <= endDate) {
                        try {
                            await Budget.findOneAndUpdate(
                                {
                                    user: id,
                                    "categories.category": category
                                },
                                {
                                    $inc: {
                                        [`categories.${categoryIndex}.spent`]: Number(amount)
                                    }
                                },
                                { new: true }
                            );
                            console.log("Budget spent amount updated successfully");
                        } catch (updateError) {
                            console.error("Error updating budget:", updateError);
                        }
                    } else {
                        console.log("Transaction date is after budget end date - not updating spent amount");
                    }
                } else {
                    console.log("Category not found in budget");
                }
            } else {
                console.log("No budget found for this category");
            }
        }

        const newBudget = await Budget.findOne({ user: id });
        
        res.status(201).json({
            success: true,
            transaction,
            newBudget,
            message: "Transaction created successfully"
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ 
            success: false,
            message: "Error creating transaction",
            error: error.message 
        });
    }
};

exports.getTransactionByUserId = async (req, res) => {
    try {
        const transaction = await Transaction.find({user : req.params.id}).populate('category');
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { type, amount, category, date, note } = req.body;
        const transaction = await Transaction.findByIdAndUpdate(req.params.id, { type, amount, category, date, note }, { new: true });
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findByIdAndDelete(req.params.id);
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
