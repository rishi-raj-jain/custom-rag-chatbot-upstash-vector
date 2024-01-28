export const runtime = 'edge'

import { Index } from '@upstash/vector'
import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf'

// Instantiate the Upstash Vector Index
const upstashVectorIndex = new Index()

// Instantiate the Hugging Face Inference API
const embeddings = new HuggingFaceInferenceEmbeddings()

export async function POST(req) {
  try {
    // a default set of messages to create vector embeddings on
    let messagesToVectorize = [
      'Rishi is pretty much active on Twitter nowadays.',
      'Rishi loves writing for Upstash',
      "Rishi's recent article on building chatbot using Upstash went viral",
      'Rishi is enjoying building launchfa.st.',
    ]
    // if the POST request is of type application/json
    if (req.headers.get('Content-Type') === 'application/json') {
      // and if the request contains array of messages to train on
      const { messages } = await req.json()
      if (typeof messages !== 'string' && messages.length > 0) {
        messagesToVectorize = messages
      }
    }
    // Call the Hugging Face Inference API to get emebeddings on the messages
    const generatedEmbeddings = await Promise.all(messagesToVectorize.map((i) => embeddings.embedQuery(i)))
    // Slice the vector into lengths of upto 256
    await Promise.all(
      generatedEmbeddings
        .map((i) => i.slice(0, 256))
        .map((vector, index) =>
          // Upsert the vector with description to be further as the context to upcoming questions
          upstashVectorIndex.upsert({
            vector,
            id: index.toString(),
            metadata: { description: messagesToVectorize[index] },
          }),
        ),
    )
    // Once done, return with a successful 200 response
    return new Response(JSON.stringify({ code: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.log(e)
    return new Response(JSON.stringify({ code: 0 }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
