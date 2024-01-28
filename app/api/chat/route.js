export const runtime = 'edge'

import Replicate from 'replicate'
import { Redis } from '@upstash/redis'
import { Index } from '@upstash/vector'
import { experimental_buildLlama2Prompt } from 'ai/prompts'
import { ReplicateStream, StreamingTextResponse } from 'ai'
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'

// Instantiate the Upstash Redis
const upstashRedis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Instantiate the Upstash Vector Index
const upstashVectorIndex = new Index()

// Instantiate the Hugging Face Inference API
const embeddings = new HuggingFaceInferenceEmbeddings()

// Instantiate the Replicate API
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req) {
  try {
    // the whole chat as array of messages
    const { messages } = await req.json()
    // assuming user - assistant chat
    // add assitant's response to the chat history
    if (messages.length > 1) {
      await upstashRedis.lpush('unique_conversation_id', JSON.stringify(messages[messages.length - 2]))
    }
    // add user's request to the chat history
    await upstashRedis.lpush('unique_conversation_id', JSON.stringify(messages[messages.length - 1]))
    // get the latest question stored in the last message of the chat array
    const userMessages = messages.filter((i) => i.role === 'user')
    const lastMessage = userMessages[userMessages.length - 1].content
    // generate embeddings of the latest question
    const queryVector = (await embeddings.embedQuery(lastMessage)).slice(0, 256)
    // console.log('The query vector got computed', queryVector.length)
    // query the relevant vectors from the embedding vector
    const queryResult = await upstashVectorIndex.query({
      vector: queryVector,
      // get the top 2 relevant results
      topK: 2,
      // do not include the whole set of embeddings in the response
      includeVectors: false,
      // include the meta data so that can get the description out of the index
      includeMetadata: true,
    })
    // console.log('The query result came in', queryResult.length)
    // using the resulting set of relevant vectors
    // filter the one that have score of greater than 70% match
    // and get the description we stored while training
    const queryPrompt = queryResult
      .filter((match) => match.score && match.score > 0.7)
      .map((match) => match.metadata.description)
      .join('\n')
    // console.log('The query prompt is', queryPrompt)
    const response = await replicate.predictions.create({
      // You must enable streaming.
      stream: true,
      // The model must support streaming. See https://replicate.com/docs/streaming
      // This is the model ID for Llama 2 70b Chat
      version: '2c1608e18606fad2812020dc541930f2d0495ce32eee50074220b87300bc16e1',
      // Format the message list into the format expected by Llama 2
      // @see https://github.com/vercel/ai/blob/99cf16edf0a09405d15d3867f997c96a8da869c6/packages/core/prompts/huggingface.ts#L53C1-L78C2
      input: {
        prompt: experimental_buildLlama2Prompt([
          {
            // create a system content message to be added as
            // the llama2prompt generator will supply it as the context with the API
            role: 'system',
            content: queryPrompt.substring(0, Math.min(queryPrompt.length, 2000)),
          },
          // also, pass the whole conversation!
          ...messages,
        ]),
      },
    })
    // stream the result to the frontend
    const stream = await ReplicateStream(response)
    return new StreamingTextResponse(stream)
  } catch (e) {
    console.log(e)
    return new Response('There was an Internal Server Error. Can you try again?', {
      status: 500,
    })
  }
}
