import React, { useRef, useEffect } from 'react'

export type CanvasProps = {
    drawOnCanvas: (ctx: CanvasRenderingContext2D) => void
    onWheel: (ctx: CanvasRenderingContext2D, e: WheelEvent) => void
    attributes?: React.CanvasHTMLAttributes<HTMLCanvasElement>
}

const Canvas = ({ drawOnCanvas, onWheel, attributes }: CanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!canvasRef.current) return

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) return

        canvas.addEventListener('wheel', (e) => onWheel(context, e))

        // let animationFrameId: number
        const render = () => {
            drawOnCanvas(context)
            requestAnimationFrame(render)
            // animationFrameId = requestAnimationFrame(render)
        }
        render()

        return () => {
            canvas.removeEventListener('wheel', (e) => onWheel(context, e))
            // TODO: Fix flickering when calling cancelAnimationFrame
            // This might help: https://stackoverflow.com/questions/40265707/flickering-images-in-canvas-animation
            // cancelAnimationFrame(animationFrameId)
        }
    }, [drawOnCanvas, onWheel])

    return <canvas ref={canvasRef} {...attributes} />
}

export default Canvas
