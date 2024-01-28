'use client'

import { useState } from 'react'
import { useChat } from 'ai/react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Maximize2, ChevronRight } from 'lucide-react'
import MemoizedMD from './components/memoized-react-markdown'

export default function InputWithButton() {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(true)
  const [training, setTraining] = useState(false)
  const { messages, input, handleInputChange, handleSubmit } = useChat()
  return (
    <>
      <form
        id="rag"
        onSubmit={(e) => {
          e.preventDefault()
          const messages = document
            .getElementById('content')
            .value.split(',')
            .filter((i) => i && i.trim().length > 0)
          if (messages) {
            setTraining(true)
            fetch('/api/train', {
              method: 'POST',
              body: JSON.stringify({ messages }),
              headers: { 'Content-Type': 'application/json' },
            })
              .then((res) => res.json())
              .then((res) => {
                if (res.code === 1) {
                  toast({
                    description: 'Context updated succesfully!',
                  })
                }
              })
              .finally(() => {
                document.getElementById('rag').reset()
                setTraining(false)
              })
          }
        }}
        className="absolute top-0 border p-3 m-2 rounded right-0 flex flex-col items-start"
      >
        <div className="cursor-pointer absolute top-1.5 right-1.5">
          <Maximize2
            size={12}
            className="fill-black"
            onClick={() => {
              setExpanded((expanded) => !expanded)
            }}
          />
        </div>
        {expanded && <span className="text-xs font-medium">Update Knowledge Base</span>}
        {expanded && (
          <textarea
            id="content"
            autoComplete="off"
            placeholder="Add to the existing knowledge base. Seperate sentences with comma (,)"
            className="mt-2 p-1 border border-black/25 outline-none text-xs h-[45px] w-[280px] rounded"
          />
        )}
        {expanded && (
          <button
            type="submit"
            disabled={training}
            className={['text-xs border mt-2 py-1 px-2 rounded cursor-pointer', !training && 'border-black/25 hover:bg-black hover:text-white'].filter((i) => i).join(' ')}
          >
            {!training ? <>Train &rarr;</> : 'Training...'}
          </button>
        )}
      </form>
      <div className="flex flex-col items-center">
        <div className="relative flex flex-col items-start w-full max-w-lg px-5 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-row w-[75vw] max-w-[500px] items-center space-x-2 fixed bottom-4">
            <Input
              id="message"
              value={input}
              type="message"
              autoComplete="off"
              onChange={handleInputChange}
              placeholder="What's your next question?"
              className="border-black/25 hover:border-black placeholder:text-black/75 rounded"
            />
            <button className="size-6 flex flex-col border border-black/50 items-center justify-center absolute right-3 rounded-full hover:bg-black hover:text-white" type="submit">
              <ChevronRight size={18} />
            </button>
          </form>
          <div className="w-full flex flex-col max-h-[90vh] overflow-y-scroll">
            {messages.map((i, _) => (
              <MemoizedMD key={_} index={_} message={i.content} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
