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
  }

  // push current canvas to history
  const snapshot = () => {
    const data = toDataURL(canvasRef.current)
    history.current.push(data)
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
    const c = canvasRef.current
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
