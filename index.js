
const express = require('express')
const app = express()
const port = 3000
const mongoose = require('mongoose')
const cors = require('cors')
const UserRoute = require('./route/UserRoute')
const BudjetRoute = require('./route/BudjetRoute')
const TransactionRoute = require('./route/TransactionRoute')
const Wallet = require('./route/Wallet')
const Category = require('./model/Category')
app.use(cors({
    origin : '*'
}))

mongoose.connect('mongodb://localhost:27017/budget').then(() => {
  console.log('Connected to MongoDB')
}).catch((error) => {
  console.error('Error connecting to MongoDB', error)
})

app.use(express.json())
app.use('/user', UserRoute)
app.use('/budjet', BudjetRoute)
app.use('/transaction', TransactionRoute)
app.use('/wallet', Wallet)


app.get("/categories", async (req, res) => {
  try {
      console.log("categories");
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})