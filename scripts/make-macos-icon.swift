import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("usage: make-macos-icon.swift INPUT OUTPUT\n", stderr)
  exit(2)
}

let input = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
guard let source = NSImage(contentsOfFile: input) else {
  fputs("cannot read input image\n", stderr)
  exit(3)
}

let side: CGFloat = 1024
let maximum: CGFloat = 860
let scale = min(maximum / source.size.width, maximum / source.size.height)
let drawSize = NSSize(width: source.size.width * scale, height: source.size.height * scale)
let drawRect = NSRect(
  x: (side - drawSize.width) / 2,
  y: (side - drawSize.height) / 2,
  width: drawSize.width,
  height: drawSize.height
)

let canvas = NSImage(size: NSSize(width: side, height: side))
canvas.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high
source.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1)
canvas.unlockFocus()

guard
  let tiff = canvas.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let png = bitmap.representation(using: .png, properties: [:])
else {
  fputs("cannot render icon\n", stderr)
  exit(4)
}

try png.write(to: URL(fileURLWithPath: output))
