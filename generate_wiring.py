from PIL import Image, ImageDraw, ImageFont
import os

# Canvas size
W, H = 900, 620
img = Image.new("RGBA", (W, H), (255, 255, 255, 220))
draw = ImageDraw.Draw(img)

# ── Colors ──────────────────────────────────────────────
BG       = (240, 245, 255, 220)
BORDER   = (50, 80, 140)
TITLE_BG = (30, 60, 120)
BOX_IN   = (200, 220, 255)
BOX_OUT  = (200, 255, 210)
BOX_BAT  = (255, 230, 180)
BOX_GND  = (220, 220, 220)
TEXT_DK  = (20, 20, 20)
TEXT_WH  = (255, 255, 255)

WIRE_RED    = (220, 40,  40)
WIRE_BLACK  = (30,  30,  30)
WIRE_BLUE   = (30,  80, 200)
WIRE_YELLOW = (200,180,  0)
WIRE_GREEN  = (30, 160,  50)
WIRE_ORANGE = (230,120,  20)

img2 = Image.new("RGBA", (W, H), BG)
img2.paste(img, (0,0), img)
img = img2
draw = ImageDraw.Draw(img)

# ── Background ──────────────────────────────────────────
draw.rectangle([0, 0, W, H], fill=BG)
draw.rectangle([4, 4, W-4, H-4], outline=BORDER, width=3)

# ── Title bar ───────────────────────────────────────────
draw.rectangle([4, 4, W-4, 52], fill=TITLE_BG)
draw.text((W//2, 28), "UPS 大機櫃接線示意圖  (AR Prototype Demo)",
          fill=TEXT_WH, anchor="mm", font=ImageFont.load_default())

# ── Helper: draw a terminal box ─────────────────────────
def terminal_box(x, y, w, h, label, color, sublabels):
    draw.rectangle([x, y, x+w, y+h], fill=color, outline=BORDER, width=2)
    draw.text((x + w//2, y + 14), label, fill=TEXT_DK, anchor="mm",
              font=ImageFont.load_default())
    step = w // len(sublabels)
    for i, sl in enumerate(sublabels):
        cx = x + step * i + step // 2
        # terminal circle
        draw.ellipse([cx-12, y+h-30, cx+12, y+h-6], fill=(255,255,255), outline=BORDER, width=2)
        draw.text((cx, y+h-18), sl, fill=TEXT_DK, anchor="mm",
                  font=ImageFont.load_default())
    return step, x, y+h

# ── INPUT block ─────────────────────────────────────────
in_labels = ["L1","L2","L3","N","PE"]
step_in, ix, iy = terminal_box(60, 80, 280, 90, "INPUT  輸入端", BOX_IN, in_labels)

# ── OUTPUT block ────────────────────────────────────────
out_labels = ["L1","L2","L3","N","PE"]
step_out, ox, oy = terminal_box(560, 80, 280, 90, "OUTPUT  輸出端", BOX_OUT, out_labels)

# ── BATTERY block ────────────────────────────────────────
bat_labels = ["BAT+","BAT-","PE"]
step_bat, bx, by = terminal_box(200, 430, 200, 90, "BATTERY  電池組", BOX_BAT, bat_labels)

# ── BYPASS block ────────────────────────────────────────
byp_labels = ["L1","L2","L3"]
step_byp, bypx, bypxy = terminal_box(490, 430, 180, 90, "BYPASS  旁路", BOX_GND, byp_labels)

# ── UPS core box ─────────────────────────────────────────
draw.rectangle([340, 170, 560, 400], fill=(230,235,255), outline=BORDER, width=2)
draw.text((450, 200), "UPS", fill=TEXT_DK, anchor="mm", font=ImageFont.load_default())
draw.text((450, 220), "主機模組", fill=TEXT_DK, anchor="mm", font=ImageFont.load_default())

# ── Wire drawing helper ──────────────────────────────────
def wire(points, color, width=4):
    for i in range(len(points)-1):
        draw.line([points[i], points[i+1]], fill=color, width=width)

# ── INPUT → UPS wires (L1 red, L2 black, L3 blue, N yellow, PE green) ──
wire_colors_in = [WIRE_RED, WIRE_BLACK, WIRE_BLUE, WIRE_YELLOW, WIRE_GREEN]
for i, (lbl, wc) in enumerate(zip(in_labels, wire_colors_in)):
    cx = ix + step_in * i + step_in // 2
    wire([(cx, iy), (cx, iy+30), (340, iy+30 + i*18)], wc)

# ── UPS → OUTPUT wires ──────────────────────────────────
wire_colors_out = [WIRE_RED, WIRE_BLACK, WIRE_BLUE, WIRE_YELLOW, WIRE_GREEN]
for i, wc in enumerate(wire_colors_out):
    cx = ox + step_out * i + step_out // 2
    wire([(cx, oy), (cx, oy+30), (560, 170 + 40 + i*18)], wc)

# ── BATTERY → UPS wires ─────────────────────────────────
bat_wcolors = [WIRE_RED, WIRE_BLACK, WIRE_GREEN]
for i, wc in enumerate(bat_wcolors):
    cx = bx + step_bat * i + step_bat // 2
    wire([(cx, by), (cx, by-20), (380 + i*30, 400)], wc)

# ── BYPASS → UPS wires ───────────────────────────────────
for i, wc in enumerate([WIRE_RED, WIRE_BLACK, WIRE_BLUE]):
    cx = bypx + step_byp * i + step_byp // 2
    wire([(cx, bypxy), (cx, bypxy-20), (490 + i*20, 400)], wc)

# ── Legend ───────────────────────────────────────────────
legend = [
    (WIRE_RED,    "L1  火線一（紅）"),
    (WIRE_BLACK,  "L2  火線二（黑）"),
    (WIRE_BLUE,   "L3  火線三（藍）"),
    (WIRE_YELLOW, "N   中性線（黃）"),
    (WIRE_GREEN,  "PE  接地線（綠）"),
    (WIRE_ORANGE, "BAT+ 電池正極"),
]
lx, ly = 60, 470
draw.text((lx, ly - 20), "線色說明", fill=TEXT_DK, font=ImageFont.load_default())
for j, (c, txt) in enumerate(legend):
    y0 = ly + j * 22
    draw.rectangle([lx, y0+2, lx+28, y0+14], fill=c)
    draw.text((lx + 36, y0), txt, fill=TEXT_DK, font=ImageFont.load_default())

# ── Save ────────────────────────────────────────────────
out_path = "/sessions/festive-trusting-noether/mnt/outputs/wiring-diagram.png"
img.save(out_path, "PNG")
print("Saved:", out_path)
