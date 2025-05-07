import mongoose from 'mongoose'

const family_schema= new mongoose.Schema({
    creator:{type:String, default:'' },
    family_name:{type:String, default:'' },
    payment_plan:{type:String,default:"1"}
})

export default mongoose.model('family',family_schema)