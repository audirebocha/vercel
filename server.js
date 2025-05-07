import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import cors from 'cors'
import neo4j from 'neo4j-driver'

//database

import db_connect from './mongo_connection/mongo_connection.js'
db_connect()

//Routes
import account from './apis/user_account.js'
import data_manager from './apis/data.js'



const app = express()
app.use(bodyParser.json())
app.use(cors({
    origin: ['http://localhost:5173', "https://tujuane-messenger.web.app","https://pedigree-msr5.onrender.com"],
    methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    credentials: true
}));
import driver from './neo4j/neo4j.js'

// const URI = 'neo4j+s://1e3a1501.databases.neo4j.io'
// const USER = 'neo4j'
// const PASSWORD = 'CJwxjVv1BTJGV9pkZ1IDfCjGMjuRkOZVIKQF9EDX5Qs'
// let driver=null

// try {
//     driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD))
//     const serverInfo = await driver.getServerInfo()
//     console.log('Connection established')
//     // console.log(serverInfo)
// } catch (err) {
//     console.log(`Connection error\n${err}\nCause: ${err.cause}`)
// }


app.get("/", (req, res) => {
    res.json({ message: "Hello world" })
})

app.get("/time",async (req,res)=>{
    const session = driver.session();
    try {
        
        const result = await session.run(`match (clock:clock) return clock;`);
        
        console.log("The time is:", result.records[0].get("clock").properties);
        result.records.map(record=>{
            console.log(record.get('clock').elementId)
        })
        res.json({message:"ok"})
      } catch (error) {
        console.error("Error creating person:", error);
      } finally {
        await session.close();
      }
    res.json()
})


app.post("/tree",async (req,res)=>{
    var data = req.body;
    const session = driver.session();
    try {
        
        const result_nodes = await session.run(`MATCH ()-[r:parent {family:"my_family1"}]-(node) RETURN DISTINCT node`);
        const result_edges = await session.run(`MATCH (parent)-[r:parent {family:"${data.family_id}"}]->(child) RETURN elementId(parent) AS parent_id, elementId(r) AS relationship_id, elementId(child) AS child_id`);
        
        // console.log(result_edges,result_nodes);
        var nodes=[]
        result_nodes.records.map(record=>{
            nodes.push({...record.get('node').properties,id:record.get("node").elementId})
        })
        var edges=[]
        result_edges.records.map(record=>{
            // console.log(record.get("element"))
            edges.push({parent:record.get("parent_id"),relationship:record.get("relationship_id"),child:record.get("child_id")})
        })
        res.json({message:"ok",nodes,edges})
      } catch (error) {
        console.error("Error creating person:", error);
        res.json({message:"not ok"})
      } finally {
        await session.close();
      }
})

//Creating new data with auto ID
app.post("/create", (req, res) => {
    var data = req.body;
    console.log(data)
    return res.json({message:"ok"})
})

//Creating new data with auto ID
app.post("/create1", (req, res) => {
    var data = req.body;
    var ref = db.ref("cart/1/" + data['name'])
    ref.set(data).then((ref) => { res.json({ message: "ok" }) }).catch((err) => { res.json({ message: "not okay" }) })
})

//Creating new data with auto ID
app.post("/new_data", (req, res) => {
    var data = req.body;
    console.log(data)
    res.json({ message: "ok" })
})

app.use("/account", account)
app.use("/data", data_manager)



app.listen(5000, () => { console.log("listenning on port 5000") })
