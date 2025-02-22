const mongoose = require('mongoose')

const BudgetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", require : true   },
  categories: [
    {
      name: { type: String },
      category: { type: mongoose.Schema.Types.ObjectId,ref : "Category"   }, 
      limit: { type: Number   },
      spent: { type: Number, default: 0 },
      startDate: { type: Date   }, 
      endDate: { type: Date   },
    },
  ],


}, {
  timestamps: true,
})

const Budget = mongoose.model('Budget', BudgetSchema)
module.exports = Budget