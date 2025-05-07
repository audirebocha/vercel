
import neo4j from 'neo4j-driver'

  // URI examples: 'neo4j://localhost', 'neo4j+s://xxx.databases.neo4j.io'
  const URI = 'neo4j+s://1e3a1501.databases.neo4j.io'
  const USER = 'neo4j'
  const PASSWORD = 'CJwxjVv1BTJGV9pkZ1IDfCjGMjuRkOZVIKQF9EDX5Qs'
  let driver=null

  try {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD))
    const serverInfo = await driver.getServerInfo()
    console.log('Connection established')
    //console.log(serverInfo)
  } catch(err) {
    console.log(`Connection error\n${err}\nCause: ${err.cause}`)
  }

  export default driver