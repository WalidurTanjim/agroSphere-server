require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const app = express();
const port = process.env.PORT || 5000;


const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
// middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));


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
    const videosCollection = db.collection('videos');

    
        // middleware
        const verifyToken = async (req, res, next) => {
          const token = req.cookies?.token;
          console.log("Token from cookies:", req.cookies?.token);
          if (!token) {
            return res.status(401).send({ message: "Unauthorized access" });
          }
          jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
              // console.error("JWT Error:", err.message);
              return res.status(401).send({ message: "Unauthorized access" });
            }
            req.decoded = decoded; 
            next();
          });
        };
    
        const verifyRole = (role) => async (req, res, next) => {
          try {
            const email = req.decoded?.email;
            if (!email)
              return res.status(401).send({ message: "Unauthorized access" });
    
            const user = await usersCollection.findOne({ email });
            if (!user || user.role !== role) {
              return res
                .status(403)
                .send({ message: `Access denied for role: ${role}` });
            }
    
            next();
          } catch (error) {
            // console.error("Error in verifyRole:", error.message);
            res.status(500).send({ message: "Internal server error" });
          }
        };
    
    
         // Generate JWT token
         app.post("/jwt", async (req, res) => {
          const { email } = req.body; 
          console.log(email)
          const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "365d",
          });
          res
            .cookie("token", token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            })
            .send({ success: true });
        });

         // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            httpOnly: true,
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });


    // users
    app.get('/users', async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exist = await usersCollection.findOne(query);
      if (exist) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    

    //videos
    app.get('/videos', async (req, res) => {
      const videos = await videosCollection.find().toArray();
      res.send(videos);
    });

    app.post('/videos', async (req, res) => {
      const newVideo = req.body;
      const result = await videosCollection.insertOne(newVideo);
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