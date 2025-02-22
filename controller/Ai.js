const Transaction = require('../model/Transaction');
const Budget = require('../model/Budget');
const User = require('../model/User');


const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('');

exports.getRecommendations = async (req, res) => {
    const id = req.params.userId;

    try {
        // Fetch user data
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const transactions = await Transaction.find({ user: user._id });
        const budgets = await Budget.find({ user: user._id });

        // Improve the prompt for better AI response
        const prompt = `
        Based on the following user transaction data: ${transactions}
        and budget data: ${budgets}, generate a **7-day prediction of transactions**.

        Also, provide **at least three** suggestions in each category:
        1. Ways to **Increase Income**
        2. Ways to **Increase Savings**
        3. Ways to **Spend Money Wisely**

        **Example JSON format you should return:**
        {
          "predictions": [
            { "date": "YYYY-MM-DD", "amount": 100, "category": "Food", type : "expense" },
             { "date": "YYYY-MM-DD", "amount": 100, "category": "Freelance", type : "income" },
          ],
          "suggestions": {
            "Increase Income": ["Freelancing", "Selling digital products", "Investing in stocks"],
            "Increase Savings": ["Reduce unnecessary subscriptions", "Cook at home", "Buy in bulk"],
            "Spend Money Wisely": ["Use cashback offers", "Compare prices before purchasing", "Set spending limits"]
          }
        }

        **Ensure the response is in raw JSON format (no markdown).**
        `;

        // Call Gemini AI
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Extract and clean up response text
        let responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            return res.status(500).json({ message: "AI response is empty or malformed" });
        }

        // Remove Markdown (```json ... ```)
        responseText = responseText.replace(/^```json\s*|```$/g, '').trim();

        // Attempt to parse JSON
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(responseText);
        } catch (error) {
            console.error("Error parsing AI response:", error);
            return res.status(500).json({ message: "Invalid AI response format" });
        }

        res.json(jsonResponse);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
