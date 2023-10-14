const express = require("express");
const app = express();
const PORT = 4000;
const mongoose = require("mongoose");
const router = express.Router();
const amqplib = require('amqplib/callback_api');
require("./models/post");
const Post = mongoose.model("Post");

const username = encodeURIComponent(process.env.MONGO_USER_NAME);
const password = encodeURIComponent(process.env.MONGO_USER_PASSWORD);
const queue = 'CREATE_POST';
const deletePostQueue = 'DELETE_POST';

mongoose.connect(`mongodb+srv://${username}:${password}@cluster0.tjwdv.mongodb.net/insta_admin?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.on("connected", () => {
    console.log("mongoose db connected");
});
mongoose.connection.on("error", (err) => {
    console.log(err);
});

amqplib.connect(process.env.RABBIT_MQ_URI, (err, conn) => {
    app.use(express.json());
    if (err) throw err;

    // Listener
    conn.createChannel((err, ch2) => {
        if (err) throw err;
        ch2.assertQueue(queue);
        ch2.assertQueue(deletePostQueue);

        ch2.consume(queue, async (msg) => {
            if (msg !== null) {
                let obj = msg.content
                obj = JSON.parse(obj)
                let post = new Post(obj);
                let res = await post.save()
                console.log(msg.content.toString());
                ch2.ack(msg);
            } else {
                console.log('Consumer cancelled by server');
            }
        });

        ch2.consume(deletePostQueue, async (msg) => {
            if (msg !== null) {
                // let obj = msg.content
                let postId = JSON.parse(obj)
                // console.log(msg.content.toString());
                Post.findOne({ _id: postId })
                    .exec((err, post) => {
                        if (err || !post) {
                            return res.status(422).json({ error: err });
                        }
                        if (post.postedBy._id.toString() === req.user._id.toString()) {
                            post.remove().then((result) => {
                                console.log("POST DELETE WITH ID" + postId)
                            }).catch((err) => {
                                console.log(err);
                            });
                        }
                    });
                // let obj = msg.content
                // obj = JSON.parse(obj)
                // let post = new Post(obj);
                // let res = await post.save()
                // console.log(msg.content.toString());
                ch2.ack(msg);
            } else {
                console.log('Consumer cancelled by server');
            }
        });
    });


    app.delete("/deletepost/:postId", (req, res) => {
        let postId = req.params.postId
        Post.findOne({ _id: req.params.postId }).exec((err, post) => {
            if (err || !post) {
                return res.status(422).json({ error: err });
            }
            if (post.postedBy._id.toString() === req.user._id.toString()) {
                post.remove().then((result) => {
                    rabbitMqService.channel.sendToQueue(deletePostQueue, Buffer.from(JSON.stringify(postId)));
                    res.json({ result });
                }).catch((err) => {
                    console.log(err);
                });
            }
        });
    });


});