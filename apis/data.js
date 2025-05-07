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


router.post("/my_tree", async (req, res) => {
    var data = req.body;
    const session = driver.session();
    try {

        const result_nodes = await session.run(
            `MATCH ()-[r:parent {family:"${data.family_id}"}]-(n) 
            WITH COLLECT(n) AS nodeMatches

            // Try to collect nodes connected by a relationship with the specified relationship ID
            OPTIONAL MATCH (b:person {family_id:"${data.family_id}"})
            WITH nodeMatches, COLLECT(b) AS relatedNodes

            WITH COALESCE(nodeMatches, []) + COALESCE(relatedNodes, []) AS allNodes
            UNWIND allNodes AS node
            WITH DISTINCT node
            ORDER BY node.sibling_no
            RETURN DISTINCT node`);
        const result_edges = await session.run(`MATCH (parent)-[r:parent {family_id:"${data.family_id}"}]->(child) RETURN r`);

        //console.log(result_edges,result_nodes);
        var nodes = []
        result_nodes.records.map(record => {
            nodes.push({ ...record.get('node').properties })
        })
        var edges = []
        result_edges.records.map(record => {
            //console.log(record)
            edges.push({ ...record.get("r").properties, id: record.get("r").elementId })
        })
        res.json({ message: "ok", nodes, edges })
    } catch (error) {
        console.error("Error creating person:", error);
        res.json({ message: "not ok" })
    } finally {
        await session.close();
    }
})


router.post("/new_child", async (req, res) => {
    var data = req.body;
    //Check if the users actions are authorised using membership type
    //console.log(data)
    if (data.user_data.default_family_id.membership_type === 'admin') {
        //Create a new node the selected node
        var node_id = await new_node(data.user_data.default_family_id.family_id, data.member, null, "member")
        //Create the relationship(selected node to new node)
        var edge_id = await new_relationship(data.user_data.default_family_id.family_id, node_id, data.node.id)
        res.json({ message: "Success fully added new child node", data: { node_id, edge_id }, code: 201 })
    } else {
        res.json({ message: "This action needs a higher clearance", code: 500 })
    }

})


router.post("/new_parent", async (req, res) => {
    var data = req.body;
    //Check if the users actions are authorised using membership type
    //console.log(data)
    if (data.user_data.default_family_id.membership_type === 'admin') {

        //Create a new node the selected node
        var results = await new_node(data.user_data.default_family_id.family_id, data.member, null, "member")
        //Create the relationship(selected node to new node)
        if (results.error == undefined) {
            var edge_id = await new_relationship(data.user_data.default_family_id.family_id, data.node.id, results)
            res.json({ message: "Success fully added new child node", data: { node_id: results, edge_id }, code: 201 })
        } else {
            res.json({ message: "Error creating the node", code: 100, error: results.error })
        }

    }

})





router.post("/edit_node", async (req, res) => {
    var data = req.body;
    if (data.user_data.default_family_id.membership_type == "admin") {
        var results = await edit_node(data.selected_node)
        if (results.error == undefined) {
            res.json({ message: "The nodes have been edited", code: 204 })
        } else {
            console.log(results.error)
            res.json({ message: "Error", code: 100 })
        }
    }
})

router.post("/edit_spouse", async (req, res) => {
    var data = req.body;
    if (data.user_data.default_family_id.membership_type == "admin") {
        //console.log(data)
        //Check if the spouse has a node
        if (data.selected_node.id == undefined) {
            //just edit the spouse node
            var results = await edit_spouse(data.selected_node.node_spouse_id, data.selected_node.new_spouse_data)
            if (results.error == undefined) {
                res.json({ message: "The spouse has been edited", code: 205 })
            } else {
                res.json({ message: "There was an error" })
            }

        } else {
            //Check if the node is there, edit that node then edit the spouse node
        }


        //await edit_node(data.selected_node)

    }
})


router.post("/delete_node", async (req, res) => {
    var data = req.body;
    if (data.user_data.default_family_id.membership_type == "admin") {
        await delete_node(data.node_element_id)
        res.json({ message: "The nodes have been deleted", code: 203 })
    }
})


router.post("/add_attached_spouse", async (req, res) => {
    var data = req.body;
    if (data.user_data.default_family_id.membership_type == "admin") {
        await add_attached_spouse(data.selected_node, data.spouse)
        res.json({ message: "The nodes have been updated", code: 205 })
    }
})


async function new_node(family_id, user_data, mongo_id, membership_type) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`create (node:person {family_id:'${family_id}',name:'${user_data['name']}',gender:${user_data["gender"]},photoURL:'${user_data['photoURL']}',email:'${user_data['email']}',phone:'${user_data['phone']}',location:'${user_data['location']}',membership_type:'${membership_type}',biography:'${user_data['biography']}',sibling_no:${user_data['sibling_no']}}) set node.element_id=elementId(node)+"at"+toString(time())+"on"+toString(date()) RETURN node`)
            //console.log(result_node.records[0].get("node").properties)
            //console.log(result_node.records[0].get('node'))
            //console.log(result_node.records[0].get("node").elementId)
            resolve(result_node.records[0].get("node").properties.element_id)
        } catch (error) {
            console.error("Error creating person:", error);
            reject({ "error": error })
        } finally {
            await session.close();
        }
    })

}


async function new_relationship(family_id, child_id, parent_id) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_edge = await session.run(`
                MATCH (parent) WHERE parent.element_id = "${parent_id}" MATCH (child) WHERE child.element_id = "${child_id}" CREATE (parent)-[r:parent {family_id:"${family_id}",child:'${child_id}',parent:'${parent_id}'}]->(child) RETURN elementId(r)
                `)
            console.log("edge:", result_edge.records[0].get('elementId(r)'))
            resolve(result_edge.records[0].get('elementId(r)'))
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}



async function edit_node(selected_node) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`
                MATCH (node:person) where element_id(node)="${selected_node.id}" 
                set node.name="${selected_node.name}"
                set node.gender=${selected_node.gender}
                set node.location="${selected_node.location}"  
                set node.phone="${selected_node.phone}" 
                set node.biography="${selected_node.biography}" 
                set node.membership_type='${selected_node.membership_type}'
                set node.photoURL="${selected_node.photoURL}" 
                set node.sibling_no=${selected_node.sibling_no}
                
                return node
                `)

            resolve(result_node.records[0].get("node").properties.element_id)
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}


async function edit_spouse(node_spouse_id, new_spouse_data) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`
                MATCH (node:person) where elementId(node)='${node_spouse_id}'
                set node.spouse='${new_spouse_data}'
                return node`)

            resolve(result_node.records[0].get("node").elementId)
        } catch (error) {
            console.error("Error creating person:", error);
            reject({ "error": error })
        } finally {
            await session.close();
        }
    })

}


async function add_attached_spouse(selected_node, spouse_data) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`
                MATCH (node:person) where elementId(node)="${selected_node.id}" 
                set node.spouse='${spouse_data}'
                
                return node
                `)

            resolve(result_node.records[0].get("node").elementId)
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}

async function get_node_data(node_element_id) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`
                MATCH (node:person) where node.element_id="${node_element_id}"
                return node
                `)

            resolve(result_node.records[0].get("node").properties)
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}


async function link_node_n_mongoid(data) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result_node = await session.run(`
                MATCH (node:person) where node.element_id="${data.node_element_id}" 
                set node.photoURL='${data['photoURL']}',
                node.email='${data['email']}',
                node.mongo_id='${data['mongo_id']}',
                node.membership_type='${data['membership_type']}'
                return node
                `)

            resolve(result_node.records[0].get("node").properties)
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}


function delete_node(node_id) {
    return new Promise(async (resolve, reject) => {
        const session = driver.session();
        try {

            var result = await session.run(
                `
                MATCH (p) where p.element_id="${node_id}" 
                OPTIONAL MATCH (incomingNode)-[r]->(p)
                OPTIONAL MATCH path = (p)-[*]->(relatedNodes) 
                delete r,path,p
                `
            )
            //console.log(result)
            resolve(result)
        } catch (error) {
            console.error("Error creating person:", error);
            reject("Error: ", error)
        } finally {
            await session.close();
        }
    })

}


router.post('/accounts', async (req, res) => {
    res.json({ message: "Hello from backend" })
})


//Invite linked
router.post('/invite_link', async (req, res) => {
    //Get the email,membership_type,node_element_id,mongoid, family_id, family_name
    var data = req.body;
    var family_data = await family.findById(data['family_id'])
    var my_mongo_data = await users.findOne({ email: data['email'] })
    //console.log(my_mongo_data, family_data, data)
    //mongo update: node_element_id,family_id,default_family_id,family_name
    my_mongo_data.family_id = [...my_mongo_data.family_id, { id: data["family_id"], name: family_data['family_name'], membership_type: data['membership_type'] }]
    my_mongo_data.default_family_id = { family_id: data['family_id'], membership_type: data['membership_type'] }
    my_mongo_data.node_element_id = data['node_element_id']
    my_mongo_data = await my_mongo_data.save()
    //neo4j update: photo_url, email, mongo_id
    var new_node_data = link_node_n_mongoid({
        email: my_mongo_data['email'],
        mongo_id: my_mongo_data.get("_id").toString(),
        photoURL: my_mongo_data['photoURL'],
        membership_type:data['membership_type'],
        node_element_id:data['node_element_id']

    })

    res.json({ message: "Invite node linking complete",data:my_mongo_data, code:123 })
})

export default router