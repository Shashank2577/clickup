import { connect } from 'nats'

async function main() {
  const nc = await connect({ servers: 'nats://localhost:4222' })
  const jsm = await nc.jetstreamManager()
  try {
    await jsm.streams.add({
      name: 'CLICKUP',
      subjects: ['clickup.>'],
      retention: 'limits' as const,
      max_age: 86400000000000,
      storage: 'file' as const,
    })
    console.log('Stream CLICKUP created')
  } catch (e: any) {
    if (e.code === '400') {
      console.log('Stream CLICKUP already exists')
    } else {
      console.error('Error:', e.message)
    }
  }
  await nc.close()
}

main()
