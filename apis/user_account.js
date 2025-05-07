import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'


import frontend_URL from '../config.js'
import driver from '../neo4j/neo4j.js'

//Models
import users from "../models/users.js"
import family from '../models/family.js'


const router = express.Router()
router.use(express.json())
router.use(bodyParser.json())
router.use(cors({
    origin: [frontend_URL],
    methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    credentials: true
}));

router.get('/', async (req, res) => {
    res.json({ message: "Hello from backend" })
})


router.post("/user_login", async (req, res) => {
    var data = req.body;
    //Check if the user is in the database or is in the neo4 email
    var user_check = await users.find({ email: data['email'] })
    //If its in the databse return welcom back message
    if (user_check.length) {
        //Check if theres a default family
        if (user_check[0]['default_family_id'] == null) {
            res.json({ message: "Welcome, please complete setup", code: 101 })
        } else {
            res.json({ message: "Welcome back", code: 102, data: user_check[0] })
        }
    }
    //If its not in the database put it into the database
    else {
        var new_user = new users({ email: data['email'], display_name: data['displayName'], photoURL: data['photoURL'] })
        var saved_data = await new_user.save()

        res.json({ message: "Welcome! Lets complete the setup", code: 101 })
    }
})

router.post("/new_family", async (req, res) => {
    var data = req.body;
    //find the organisations under this body
    var query_data = await users.findOne({ email: data['email'] })
    //console.log(query_data, data)
    if (query_data != null) {
        //console.log(query_data)
        if (query_data['default_family'] == null) {
            //Create a new family 
            var new_family = new family({ family_name: data.family_data['family_name'], payment_plan: data.family_data['payment_plan'], creator: data['email'] })
            var new_saved_family = await new_family.save()
            //Update the family id at the user
            var new_family_id = new_saved_family.get("_id").toString()
            //update the default family id
            query_data.family_id = [...query_data.family_id, { id: new_family_id, name: data.family_data['family_name'], membership_type: "admin" }]
            query_data.default_family_id = { family_id: new_family_id, membership_type: "admin" }
            query_data= await query_data.save()
            //Check if there is an element in neo4j
            const session = driver.session();
            try {
                var result_node = await session.run('MATCH (p:person {name:"something"}) RETURN p')
                //console.log(result_node.records)
                var mongo_id=query_data._id.toString()
                if(result_node.records.length===0){
                    var node_element_id=await new_node(new_family_id,data['user_data'],mongo_id,"admin")
                    query_data.node_element_id=node_element_id
                    var new_user_data=await query_data.save()
                    res.json({message:"setup complete", code:103, data:new_user_data})
                }
            } catch (error) {
                console.error("Error creating person:", error);
            } finally {
                await session.close();
            }
            
        }
        
    } else {
        res.json({ message: "Nothing here" })
    }

})

async function new_node(family_id,user_data,mongo_id,membership_type){
    return new Promise(async (resolve,reject)=>{
        const session = driver.session();
            try {
                var result_node = await session.run(`create (node:person {family_id:'${family_id}',mongo_id:'${mongo_id}',name:'${user_data['displayName']}',photoURL:'${user_data['photoURL']}',email:'${user_data['email']}',membership_type:'${membership_type}',gender:true,sibling_no:0}) set node.element_id=elementId(node)+"at"+toString(time())+"on"+toString(date()) RETURN node`)
                //console.log(result_node.records[0].get("node").properties)
                console.log(result_node.records[0].get('node'))
                console.log(result_node.records[0].get("node").properties.element_id)
                resolve(result_node.records[0].get("node").properties.element_id)
            } catch (error) {
                console.error("Error creating person:", error);
                reject("Error: ",error)
            } finally {
                await session.close();
            } 
    })
    
}


router.post("/tree", async (req, res) => {
    var data = req.body;
    const session = driver.session();
    try {

        const result_nodes = await session.run(`MATCH ()-[r:parent {family:"my_family1"}]-(node) RETURN DISTINCT node`);
        const result_edges = await session.run(`MATCH (parent)-[r:parent {family:"${data.family_id}"}]->(child) RETURN elementId(parent) AS parent_id, elementId(r) AS relationship_id, elementId(child) AS child_id`);

        // console.log(result_edges,result_nodes);
        var nodes = []
        result_nodes.records.map(record => {
            nodes.push({ ...record.get('node').properties, id: record.get("node").elementId })
        })
        var edges = []
        result_edges.records.map(record => {
            // console.log(record.get("element"))
            edges.push({ parent: record.get("parent_id"), relationship: record.get("relationship_id"), child: record.get("child_id") })
        })
        res.json({ message: "ok", nodes, edges })
    } catch (error) {
        console.error("Error creating person:", error);
        res.json({ message: "not ok" })
    } finally {
        await session.close();
    }
})


router.post("/org_data", async (req, res) => {
    var data = req.body;
    //find the organisations under this body
    var query_data = await users.find({ email: data['email'] })
    if (query_data.length) {
        console.log(query_data)
        res.json({ data: query_data[0]['organisations'] })
    } else {
        res.json({ message: "Nothing here" })
    }

})


router.post('/accounts', async (req, res) => {
    res.json({ message: "Hello from backend" })
})


export default router