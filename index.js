const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

const app = express();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yxjl2sj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

app.use(cors());
app.use(express.json());

async function run() {
    try {
        const usersCollection = client.db('storyKeeper').collection('users');

        app.post('/users', async (req, res) => {
            const email = req.body.email
            const userQuery = { email: email }
            const alreadyRegistered = await usersCollection.find(userQuery).toArray();
            if (alreadyRegistered) {
                return;
            }
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });
    }
    finally {

    }
}

run().catch(e => console.error(e));


app.get('/', async (req, res) => {
    res.send('the story keeper server is running');
})

app.listen(port, () => console.log(`the story keeper server running on ${port}`))