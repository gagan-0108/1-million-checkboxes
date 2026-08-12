import http from 'http';
import path from 'path';

import express from 'express';
import { Server, Socket } from 'socket.io';

import { publisher, redis, subscriber } from './redis-connection.js';



const checkboxsize = 100
const checkbox_state_key = 'checkbox-state'

const rateLimitingHashMap = new Map();

async function main() {
    const PORT = process.env.PORT || 7000;
    const app = express()


    const server = http.createServer(app);
    const io = new Server()
    io.attach(server)

    await subscriber.subscribe('internal-server:checkbox:change');
    subscriber.on('message', (channel, message) => {
        if (channel === 'internal-server:checkbox:change') {
            const { index, checked } = JSON.parse(message);
            
            
            io.emit('server:checkbox:change', { index, checked });
        }
    });

    // for socket io handlers
    io.on('connection', (Socket) => {
        console.log(`socket connected`, {id: Socket.id});

        Socket.on('client:checkbox:change', async (data) => {
            console.log(`[socket: ${Socket.id}]:client:checkbox:change`, data);
            
            // rate limiting check
            const lastOperationTime = rateLimitingHashMap.get(Socket.id)
            if (lastOperationTime) {
                const timeElapsed = Date.now() - lastOperationTime;
                if(timeElapsed < 5.5 * 1000) {
                    Socket.emit('server:error', {error: 'please wait before changing another checkbox'})
                    return;
                }
            } 
    rateLimitingHashMap.set(Socket.id, Date.now())

            const existingState = await redis.get(checkbox_state_key);

            if (existingState) {
                const remoteData = JSON.parse(existingState );
                remoteData[data.index] = data.checked;
                 await redis.set(checkbox_state_key, JSON.stringify(remoteData));
            } else {
                await redis.set(
                    checkbox_state_key,
                    JSON.stringify(new Array(checkboxsize).fill(false)));
            }
           
            await publisher.publish(
                'internal-server:checkbox:change',
                JSON.stringify(data)
            );
        });
    });
    


    // for express
    app.use(express.static(path.resolve('./public')));

    app.get('/checkboxes', async (req,res) => {
        const existingState = await redis.get(checkbox_state_key);
            const remoteData = JSON.parse(existingState);
        if (existingState) {
            return res.json({checkboxes: remoteData});
        }
        return res.json({checkboxes: new Array(checkboxsize).fill(false)});
    });

    app.get('/health', (req, res) => {
        res.json({ healthy: true });
    });



    server.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

main();