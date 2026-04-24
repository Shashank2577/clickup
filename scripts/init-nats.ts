import { connect } from 'nats'

async function init() {
  const natsUrl = process.env['NATS_URL'] || 'nats://localhost:4222'
  console.log('Connecting to NATS at ' + natsUrl + '...')
  
  const nc = await connect({ servers: natsUrl })
  const jsm = await nc.jetstreamManager()

  const streams = [
    {
      name: 'clickup',
      subjects: ['task.*', 'comment.*', 'doc.*', 'workspace.*', 'notification.*', 'file.*', 'goal.*', 'view.*'],
    }
  ]

  for (const stream of streams) {
    try {
      await jsm.streams.add(stream)
      console.log('✓ Created stream: ' + stream.name + ' with subjects ' + stream.subjects.join(', '))
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log('ℹ Stream ' + stream.name + ' already exists')
      } else {
        console.error('✗ Failed to create stream ' + stream.name + ':', err.message)
      }
    }
  }

  await nc.close()
}

init().catch(console.error)
