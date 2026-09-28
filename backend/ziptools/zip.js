// Minimal dependency-free ZIP writer/reader (deflate). Replaces the python3
// ziptools so backups work on serverless hosts like Vercel where python3 and a
// writable filesystem are not available for spawning helper processes.

import zlib from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// entries: [{ name: 'relative/path', data: Buffer }]
export function createZip(entries) {
  const fileChunks = []
  const central = []
  let offset = 0
  const dosTime = 0
  const dosDate = (1 << 5) | 1

  for (const e of entries) {
    const name = String(e.name || '').replace(/\\/g, '/')
    if (!name) continue
    const nameBuf = Buffer.from(name, 'utf8')
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data || '')
    let comp
    try { comp = zlib.deflateRawSync(data) } catch (err) { comp = null }
    let method = 8
    if (!comp || comp.length >= data.length) { comp = data; method = 0 }
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    fileChunks.push(local, nameBuf, comp)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4)
    cd.writeUInt16LE(20, 6)
    cd.writeUInt16LE(0, 8)
    cd.writeUInt16LE(method, 10)
    cd.writeUInt16LE(dosTime, 12)
    cd.writeUInt16LE(dosDate, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)

    offset += local.length + nameBuf.length + comp.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length & 0xffff, 8)
  end.writeUInt16LE(entries.length & 0xffff, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...fileChunks, centralBuf, end])
}

// Returns [{ name, data: Buffer }]
export function readZip(buf) {
  let eocd = -1
  const min = Math.max(0, buf.length - 66000)
  for (let i = buf.length - 22; i >= min; i--) {
    if (i >= 0 && buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a valid zip (missing end-of-central-directory)')

  const count = buf.readUInt16LE(eocd + 10)
  let cdOff = buf.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (cdOff + 46 > buf.length || buf.readUInt32LE(cdOff) !== 0x02014b50) throw new Error('Corrupt central directory')
    const method = buf.readUInt16LE(cdOff + 10)
    const compSize = buf.readUInt32LE(cdOff + 20)
    const nameLen = buf.readUInt16LE(cdOff + 28)
    const extraLen = buf.readUInt16LE(cdOff + 30)
    const commentLen = buf.readUInt16LE(cdOff + 32)
    const localOff = buf.readUInt32LE(cdOff + 42)
    const name = buf.slice(cdOff + 46, cdOff + 46 + nameLen).toString('utf8')
    if (name.endsWith('/')) { cdOff += 46 + nameLen + extraLen + commentLen; continue }
    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('Corrupt local header for ' + name)
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const comp = buf.slice(dataStart, dataStart + compSize)
    let data
    if (method === 0) data = comp
    else if (method === 8) data = zlib.inflateRawSync(comp)
    else throw new Error('Unsupported compression method ' + method + ' for ' + name)
    entries.push({ name, data })
    cdOff += 46 + nameLen + extraLen + commentLen
  }
  return entries
}
