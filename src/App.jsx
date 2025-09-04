import React, { useEffect, useRef, useState } from 'react'
import { HistoryStack } from './utils/history.js'

const toDataURL = (canvas) => canvas.toDataURL('image/png')

const useImage = () => {
  const [img, setImg] = useState(null)
  const load = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => { setImg(image); resolve(image) }
      image.onerror = reject
      image.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  return { img, setImg, load }
}

export default function App(){
  const canvasRef = useRef(null)
  const viewRef = useRef(null) // overlay for crop rect
  const [ctx, setCtx] = useState(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [blur, setBlur] = useState(0)
  const [grayscale, setGrayscale] = useState(0)
  const [format, setFormat] = useState('png')
  const [fileName, setFileName] = useState('export')
  const [cropRect, setCropRect] = useState(null)
  const [isCropping, setIsCropping] = useState(false)
  const { img, setImg, load } = useImage()
  const history = useRef(new HistoryStack(30))
  const [thumbs, setThumbs] = useState([]) 
  const [layers, setLayers] = useState([]) // { id, type:'sticker'|'text', x, y, text?, emoji?, fontSize? }
  const [activeLayerId, setActiveLayerId] = useState(null)


  // draw function
  const draw = () => {
    if(!ctx || !img) return
    const canvas = canvasRef.current
    const w = img.width * scale
    const h = img.height * scale
    // Resize canvas to fit rotated bounds
    const rad = rotation * Math.PI / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    const rw = Math.ceil(w * cos + h * sin)
    const rh = Math.ceil(w * sin + h * cos)
    canvas.width = rw
    canvas.height = rh
    ctx.save()
    ctx.clearRect(0,0,rw,rh)
    ctx.translate(rw/2, rh/2)
    ctx.rotate(rad)
    ctx.filter = `brightness(${brightness}%) blur(${blur}px) grayscale(${grayscale}%)`
    ctx.drawImage(img, -w/2, -h/2, w, h)
    ctx.restore()
    // 叠加：贴纸/文本层（位于当前 canvas 坐标系）
    layers.forEach(l => {
    if (l.type === 'sticker') {
        ctx.save()
        ctx.font = `${l.size || 72}px system-ui, Apple Color Emoji, Segoe UI Emoji`
        ctx.textBaseline = 'top'
        ctx.fillText(l.emoji || '😀', l.x || 10, l.y || 10)
        ctx.restore()
    } else if (l.type === 'text') {
        ctx.save()
        ctx.font = `${l.size || 32}px ui-sans-serif, system-ui, Arial`
        ctx.fillStyle = l.color || '#ffffff'
        ctx.textBaseline = 'top'
        ctx.fillText(l.text || '双击编辑', l.x || 10, l.y || 10)
        ctx.restore()
    }
    })

  }

  // push current canvas to history
    const snapshot = () => {
    const data = toDataURL(canvasRef.current)
    history.current.push(data)
    // 生成小尺寸缩略图（宽 120）
    const imgEl = new Image()
    imgEl.onload = () => {
    const t = document.createElement('canvas')
    const th = t.getContext('2d')
    const w = 120
    const h = Math.round((imgEl.height / imgEl.width) * w)
    t.width = w; t.height = h
    th.drawImage(imgEl, 0, 0, w, h)
    setThumbs(prev => {
    const arr = history.current.stack.map((_, i) => prev[i] ?? null)
    arr[history.current.index] = t.toDataURL('image/png')
    return arr
    })
    }
    imgEl.src = data
    }


  const restoreFromDataURL = (dataURL) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const c = canvasRef.current
      const cctx = c.getContext('2d')
      c.width = image.width; c.height = image.height
      cctx.clearRect(0,0,c.width,c.height)
      cctx.drawImage(image, 0, 0)
      resolve()
    }
    image.src = dataURL
  })

  // handlers
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if(!file) return
    await load(file)
  }

useEffect(() => {
  const overlay = viewRef.current
  if(!overlay) return
  let dragging = null
  const hitTest = (x,y) => {
    // 简单命中：按文本/贴纸大致范围，实际可加宽高测量
    for (let i = layers.length-1; i >= 0; i--) {
      const l = layers[i]
      const w = (l.type==='sticker' ? (l.size||72) : Math.max((l.text||'').length* (l.size||32)*0.6, 60))
      const h = (l.size||32) * 1.2
      if (x>=l.x && x<=l.x+w && y>=l.y && y<=l.y+h) return l
    }
    return null
  }
  const onDown = (e) => {
    if (isCropping) return // 裁剪模式优先
    const rect = overlay.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const hit = hitTest(x,y)
    if (hit) {
      dragging = { id: hit.id, dx: x - hit.x, dy: y - hit.y }
      setActiveLayerId(hit.id)
    }
  }
  const onMove = (e) => {
    if(!dragging) return
    const rect = overlay.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    setLayers(ls => ls.map(l => l.id===dragging.id ? {...l, x: x - dragging.dx, y: y - dragging.dy} : l))
    draw()
  }
  const onUp = () => {
    if (dragging) { dragging = null; snapshot() }
  }
  overlay.addEventListener('mousedown', onDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  return () => {
    overlay.removeEventListener('mousedown', onDown)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}, [isCropping, layers, ctx, img, scale, rotation, brightness, blur, grayscale])

    useEffect(() => {
  const c = canvasRef.current
  if (!c) return
  const cctx = c.getContext('2d')
  setCtx(cctx)
}, [])

    
  useEffect(() => { draw() }, [img, scale, rotation, brightness, blur, grayscale])

  // After first draw for an image, snapshot to history
  useEffect(() => {
    if(!img || !ctx) return
    draw()
    snapshot()
  }, [img, ctx])

  const exportImage = () => {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    const dataURL = canvasRef.current.toDataURL(mime, 0.92)
    const a = document.createElement('a')
    a.href = dataURL
    a.download = `${fileName || 'export'}.${format}`
    a.click()
  }

  const doRotate = (delta) => { setRotation(r => r + delta); setTimeout(snapshot, 0) }
  const doScale = (delta) => { setScale(s => Math.max(0.1, s + delta)); setTimeout(snapshot, 0) }

    const applyCrop = async () => {
    if (!cropRect) return
    const c = canvasRef.current
    const temp = document.createElement('canvas')
    const tctx = temp.getContext('2d')
    temp.width = cropRect.w
    temp.height = cropRect.h
    tctx.drawImage(c, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h)

    // 用裁剪结果更新画布
    c.width = temp.width
    c.height = temp.height
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(temp, 0, 0)

    // 关键：把裁剪后的内容作为新的 img 源
    const dataURL = c.toDataURL('image/png')
    const newImg = new Image()
    newImg.onload = () => {
        // 重置状态，避免 draw() 用旧图
        setScale(1)
        setRotation(0)
        // 可选：滤镜也重置，保证一致性
        setBrightness(100)
        setBlur(0)
        setGrayscale(0)

        // 重置历史，并以裁剪结果作为基线
        history.current.reset()
        history.current.push(dataURL)

        // 更新源图
        setImg(newImg)

        // 结束裁剪态
        setCropRect(null)
        setIsCropping(false)
    }
    newImg.src = dataURL
    }


  const undo = async () => {
    const prev = history.current.undo()
    if(prev){ await restoreFromDataURL(prev) }
  }
  const redo = async () => {
    const nxt = history.current.redo()
    if(nxt){ await restoreFromDataURL(nxt) }
  }

  // crop interactions on overlay
  useEffect(() => {
    const overlay = viewRef.current
    if(!overlay) return
    let start = null
    const onDown = (e) => {
      if(!isCropping) return
      const rect = overlay.getBoundingClientRect()
      start = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setCropRect({ x: start.x, y: start.y, w: 0, h: 0 })
    }
    const onMove = (e) => {
      if(!isCropping || !start) return
      const rect = overlay.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const w = Math.max(1, x - start.x)
      const h = Math.max(1, y - start.y)
      setCropRect(r => ({...r, w, h}))
    }
    const onUp = () => { start = null }
    overlay.addEventListener('mousedown', onDown)
    overlay.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      overlay.removeEventListener('mousedown', onDown)
      overlay.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isCropping])
    
    // ✅ 快捷键映射（Cmd/Ctrl + ...）
const useHotkeys = (handlers) => {
  React.useEffect(() => {
    const onKey = (e) => {
      const cmd = e.metaKey || e.ctrlKey
      const shift = e.shiftKey
      if (cmd && !shift && e.key.toLowerCase() === 'z') { e.preventDefault(); handlers.undo?.() }
      else if (cmd && shift && e.key.toLowerCase() === 'z') { e.preventDefault(); handlers.redo?.() }
      else if (cmd && e.key === '+') { e.preventDefault(); handlers.zoomIn?.() }
      else if (cmd && e.key === '-') { e.preventDefault(); handlers.zoomOut?.() }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); handlers.rotate?.() }
      else if (cmd && e.key.toLowerCase() === 's') { e.preventDefault(); handlers.exportImg?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}

useHotkeys({
  undo, 
  redo, 
  zoomIn: () => doScale(0.1),
  zoomOut: () => doScale(-0.1),
  rotate: () => doRotate(90),
  exportImg: () => exportImage()
})

  return (
    <div>
      <header>
        <h1>Quark Image Editor <span className="badge">MVP</span></h1>
        <div className="toolbar">
          <input type="file" accept="image/*" onChange={handleFile} />
          <button onClick={() => setIsCropping(v => !v)} disabled={!img}>{isCropping ? '取消裁剪' : '开始裁剪'}</button>
          <button onClick={applyCrop} disabled={!img || !cropRect}>应用裁剪</button>
          <button onClick={() => doRotate(-90)} disabled={!img}>左转90°</button>
          <button onClick={() => doRotate(90)} disabled={!img}>右转90°</button>
          <button onClick={() => doScale(0.1)} disabled={!img}>放大</button>
          <button onClick={() => doScale(-0.1)} disabled={!img}>缩小</button>
          <button onClick={undo} disabled={!history.current.canUndo()}>撤销 ⌘Z</button>
          <button onClick={redo} disabled={!history.current.canRedo()}>重做 ⇧⌘Z</button>
        </div>
      </header>

      <div className="container">
        <div className="panel">
          <p className="section-title">滤镜</p>
          <div className="row">
            <label>亮度</label>
            <input className="range" type="range" min="50" max="150" value={brightness} onChange={e=>setBrightness(+e.target.value)} />
            <span className="kbd">{brightness}%</span>
          </div>
          <div className="row">
            <label>模糊</label>
            <input className="range" type="range" min="0" max="6" step="0.5" value={blur} onChange={e=>setBlur(+e.target.value)} />
            <span className="kbd">{blur}px</span>
          </div>
          <div className="row">
            <label>灰度</label>
            <input className="range" type="range" min="0" max="100" value={grayscale} onChange={e=>setGrayscale(+e.target.value)} />
            <span className="kbd">{grayscale}%</span>
                  </div>
        <p className="section-title">图层</p>
            <div className="row">
            <button onClick={() => {
                const id = crypto.randomUUID?.() || String(Date.now())
                setLayers(v => [...v, { id, type:'sticker', emoji:'😀', x:20, y:20, size:72 }])
                setActiveLayerId(id)
                setTimeout(snapshot, 0)
            }}>+ 贴纸</button>
            <button onClick={() => {
                const id = crypto.randomUUID?.() || String(Date.now())
                setLayers(v => [...v, { id, type:'text', text:'编辑文本', x:20, y:120, size:32, color:'#fff' }])
                setActiveLayerId(id)
                setTimeout(snapshot, 0)
            }}>+ 文本</button>
            </div>
            <div className="row" style={{flexDirection:'column', alignItems:'stretch'}}>
            {layers.map(l => (
                <button key={l.id} onClick={()=>setActiveLayerId(l.id)}
                style={{textAlign:'left', border:'1px solid #2b3645', borderRadius:8, padding:'6px 8px', margin:'4px 0',
                background: activeLayerId===l.id? '#0b1220':'#111827', color:'#e5e7eb'}}>
                {l.type==='sticker' ? `贴纸：${l.emoji}` : `文本：${l.text}`}
                </button>
            ))}
            </div>
         <div className="row" style={{flexDirection:'column', alignItems:'stretch'}}>
            <p className="section-title">历史记录</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, maxHeight:240, overflow:'auto'}}>
                {thumbs.map((t, i) => (
                <button key={i}
                    onClick={async () => { const d = history.current.stack[i]; if(d){ await restoreFromDataURL(d); history.current.index = i } }}
                    style={{padding:0, border: history.current.index===i? '2px solid #3b82f6':'1px solid #2b3645', borderRadius:8, background:'#0b1220'}}>
                    {t ? <img alt={`snap-${i}`} src={t} style={{display:'block', width:'100%', borderRadius:8}}/> : <div style={{height:68}}/>}
                </button>
                ))}
            </div>
            </div>
        </div>

        <div className="panel" style={{position:'relative', padding:0}}>
          <div className="canvas-wrap" ref={viewRef} style={{position:'relative'}}>
            <canvas ref={canvasRef} />
            {isCropping && cropRect && (
              <div style={{
                position:'absolute', left: cropRect.x, top: cropRect.y,
                width: cropRect.w, height: cropRect.h,
                border:'2px dashed #3b82f6', background:'rgba(59,130,246,.15)'
              }}/>
            )}
          </div>
        </div>

        <div className="panel">
          <p className="section-title">导出</p>
          <div className="row">
            <input placeholder="文件名" value={fileName} onChange={e=>setFileName(e.target.value)} />
            <select value={format} onChange={e=>setFormat(e.target.value)}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>
          <div className="row">
            <button onClick={exportImage} disabled={!img}>导出图片</button>
          </div>
          <div className="footer">
            <span>快捷键：<span className="kbd">⌘Z</span> 撤销，<span className="kbd">⇧⌘Z</span> 重做</span>
            <a className="link" href="https://github.com/huanhunmao" target="_blank">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  )
}
