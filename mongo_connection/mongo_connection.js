import mongoose from "mongoose";


async function db_connect(){
    var uri="mongodb+srv://root:123@cluster0.u5atqck.mongodb.net/sharespace?retryWrites=true&w=majority"
    mongoose.connect('mongodb+srv://root:123@cluster0.u5atqck.mongodb.net/family_tree?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('Connected!'))
    .catch(error=>{
        console.log(error)
    })
}

export default db_connect