const mongoose = require('mongoose')

const TransactionSchema = new mongoose.Schema( {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref : "Category", required: true }, 
    date: { type: Date, default: Date.now },
    note: { type: String },
  },
  { timestamps: true }
);


  const Transaction = mongoose.model('Transaction', TransactionSchema)

  module.exports = Transaction