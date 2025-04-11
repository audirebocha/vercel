import mongoose from 'mongoose'


const family_schema=new mongoose.Schema({
    name:{type:String,required:true},
    id:{type:String,required:true},
    membership_type:{type:String,required:true}
})

const users_schema= new mongoose.Schema({
    email:{type:String, default:'' },
    phone:{type:String, default:'' },
    display_name:{type:String, default:'' },
    photoURL:{type:String, default:'' },
    node_element_id:{type:String, default:'' },
    family_id:[family_schema],
    default_family_id: {type:Map, of:String, default:null},
    //default_family_id: {type:Map, of:String, default:{family_id:null,membership_type:null}},
})

export default mongoose.model('users',users_schema)