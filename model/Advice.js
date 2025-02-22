const mongoose = require('mongoose')

const AdviceSchema = new mongoose.Schema({
    title : {
        type : String,
        required : true
    },
    description : {
        type : String,
        required : true
    }
}, {
    timestamps : true
})

const Advice = mongoose.model('Advice', AdviceSchema)
module.exports = Advice