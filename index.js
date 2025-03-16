require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2yrio.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // database info
    const db = client.db('agroSphere');
    const usersCollection = db.collection('users');
    const forumCollection = db.collection('forum')


    // users
    app.get('/users', async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.post('/users', async(req, res) => {
        const newUser = req.body;
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
    })

    // forum page 

    app.post('/forum', async (req, res) => {
      const query = req.body;
      const result = await forumCollection.insertOne(query);
      res.send(result);
    });

    app.get('/forum', async(req , res)=>{
      const result = await forumCollection.find().toArray()
      res.send(result)
    })

    app.patch('/forum/upvote/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { upVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      res.send(result);
  });

  // **Increase Downvote**
  app.patch('/forum/downvote/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { downVote: 1 } };
      const result = await forumCollection.updateOne(query, update);
      res.send(result);
  });

    


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('AgroSphere server is running');
})

app.listen(port, () => {
    console.log("Humm, AgroSphere server is running...")
})