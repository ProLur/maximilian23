"""
MAXIMILIAN 23 - Fase 2: comprobacion de expresiones y movimientos
=================================================================
Abre maximilian23.blend (generado por maximilian_head.py) y produce:
  - expresiones.png      hoja con todas las expresiones (--sheet)
  - demo_fase2.mp4       video con parpadeo, miradas, atencion, habla y emociones (--video)
  - maximilian23_demo.blend   la misma demo, para reproducirla en Blender (barra espaciadora)

Uso:
    blender --background blender/maximilian23.blend --python blender/maximilian_demo.py -- \
        --out blender/renders --expr lives/data/expresiones.json --sheet --video

El movimiento se calcula aqui en Python con las mismas reglas que usara el visor web:
flotacion con senos de periodos no multiplos (no se repite), parpadeos aleatorios,
la mirada se adelanta a la cabeza, y la antena reacciona con un muelle amortiguado.
"""

import json
import math
import os
import random
import sys

import bpy
import numpy as np

FPS = 24
EYES = ("Ojo_L", "Ojo_R")


def keys(name):
    return bpy.data.objects[name].data.shape_keys.key_blocks


def clear_face():
    for name in EYES + ("Boca",):
        for kb in keys(name)[1:]:
            kb.value = 0.0


def apply_face(state, weight=1.0, acc=None):
    """Suma los pesos de una expresion en acc[(objeto, key)]."""
    acc = {} if acc is None else acc
    targets = {"ojos": EYES, "ojo_l": ("Ojo_L",), "ojo_r": ("Ojo_R",), "boca": ("Boca",)}
    for group, objs in targets.items():
        for key, w in state.get(group, {}).items():
            for ob in objs:
                acc[(ob, key)] = acc.get((ob, key), 0.0) + w * weight
    return acc


def head_angles(state, weight=1.0):
    c = state.get("cabeza", {})
    return (c.get("asentir", 0) * weight, c.get("inclinar", 0) * weight, c.get("girar", 0) * weight)


def set_head(pitch, roll, yaw):
    bpy.data.objects["Pivote_Cabeza"].rotation_euler = (math.radians(pitch), math.radians(roll),
                                                         math.radians(yaw))


def setup_cycles(res, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.resolution_percentage = 100


def set_camera(loc, lens):
    cam = bpy.context.scene.camera
    cam.location = loc
    cam.data.lens = lens


# --------------------------------------------------------------------------
# Hoja de expresiones
# --------------------------------------------------------------------------
def sheet_states(expr):
    e = expr
    return [
        ("reposo", e["reposo"]),
        ("parpadeo", {"ojos": {"Parpadeo": 1}}),
        ("guino", e["guino"]),
        ("mirar_derecha", {"ojos": {"Mirar_Derecha": 1}, "cabeza": {"girar": 6}}),
        ("mirar_izquierda", {"ojos": {"Mirar_Izquierda": 1}, "cabeza": {"girar": -6}}),
        ("mirar_arriba", {"ojos": {"Mirar_Arriba": 1}, "cabeza": {"asentir": -5}}),
        ("mirar_abajo", {"ojos": {"Mirar_Abajo": 1}, "cabeza": {"asentir": 5}}),
        ("alegria", e["alegria"]),
        ("sorpresa", e["sorpresa"]),
        ("tristeza", e["tristeza"]),
        ("serio", e["serio"]),
        ("inclinar", {"cabeza": {"inclinar": 8}}),
        ("habla_A", {"boca": {"Habla_A": 1}}),
        ("habla_E", {"boca": {"Habla_E": 1}}),
        ("habla_O", {"boca": {"Habla_O": 1}}),
        ("atencion", {"ojos": {"Sorpresa": 0.4}, "cabeza": {"asentir": -6}}),
    ]


def compose(paths, cols, out_path):
    tiles = []
    for p in paths:
        im = bpy.data.images.load(p)
        w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4))
    h, w = tiles[0].shape[:2]
    rows = math.ceil(len(tiles) / cols)
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    sheet[..., 3] = 1.0
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * h          # las imagenes de Blender empiezan por abajo
        sheet[y0:y0 + h, c * w:(c + 1) * w] = t
    img = bpy.data.images.new("hoja", cols * w, rows * h, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()


def render_sheet(expr, out_dir):
    sc = bpy.context.scene
    setup_cycles(400, 24)
    set_camera((-0.5, -4.8, 0.5), 60)
    tile_dir = os.path.join(out_dir, "expresiones")
    os.makedirs(tile_dir, exist_ok=True)
    paths = []
    for name, state in sheet_states(expr):
        clear_face()
        for (ob, key), w in apply_face(state).items():
            keys(ob)[key].value = min(w, 1.0)
        set_head(*head_angles(state))
        sc.render.filepath = os.path.join(tile_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(sc.render.filepath)
        print("Expresion:", name)
    compose(paths, 4, os.path.join(out_dir, "expresiones.png"))
    clear_face()
    set_head(0, 0, 0)


# --------------------------------------------------------------------------
# Demo animada
# --------------------------------------------------------------------------
def smoothstep(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def envelope(t, t0, t1, rin=0.25, rout=0.35):
    """0 -> 1 entre t0 y t0+rin, se mantiene, y vuelve a 0 entre t1 y t1+rout."""
    return smoothstep((t - t0) / rin) * (1 - smoothstep((t - t1) / rout))


def idle_motion(t):
    """Flotacion y balanceo con periodos no multiplos: nunca se repite igual."""
    tau = 2 * math.pi
    pitch = 1.2 * math.sin(tau * t / 5.3) + 0.5 * math.sin(tau * t / 2.9 + 1.0)
    roll = 1.4 * math.sin(tau * t / 6.7 + 0.5)
    yaw = 2.2 * math.sin(tau * t / 8.1) + 0.6 * math.sin(tau * t / 3.3 + 2.0)
    lift = 0.025 * math.sin(tau * t / 3.7) + 0.008 * math.sin(tau * t / 1.9 + 0.7)
    return pitch, roll, yaw, lift


def blink_weight(t, blinks):
    w = 0.0
    for b in blinks:
        x = t - b
        if 0 <= x < 0.07:
            w = max(w, smoothstep(x / 0.07))
        elif 0.07 <= x < 0.11:
            w = 1.0
        elif 0.11 <= x < 0.25:
            w = max(w, 1 - smoothstep((x - 0.11) / 0.14))
    return w


def make_syllables(t0, t1, rng):
    """Silabas con forma de boca y duracion variables, y pausas entre palabras."""
    out, t, left = [], t0, rng.randint(2, 5)
    while t < t1:
        dur = rng.uniform(0.11, 0.2)
        shape = rng.choices(["Habla_A", "Habla_E", "Habla_O"], weights=[5, 4, 2])[0]
        out.append((t, dur, shape, rng.uniform(0.55, 1.0)))
        t += dur
        left -= 1
        if left == 0:
            t += rng.uniform(0.12, 0.3)
            left = rng.randint(2, 5)
    return out


def speech_weights(t, syllables):
    acc = {}
    for s0, dur, shape, amp in syllables:
        u = (t - s0) / dur
        if 0 <= u <= 1:
            acc[shape] = acc.get(shape, 0.0) + amp * math.sin(math.pi * u)
    return acc


def build_demo(expr):
    rng = random.Random(23)
    E = expr
    # (inicio, fin, estado) - el estado usa el mismo formato que expresiones.json
    events = [
        (1.5, 3.0, {"ojos": {"Mirar_Derecha": 1}, "cabeza": {"girar": 10}}),
        (3.3, 4.7, {"ojos": {"Mirar_Izquierda": 1}, "cabeza": {"girar": -10}}),
        (5.0, 5.8, {"ojos": {"Mirar_Arriba": 1}, "cabeza": {"asentir": -6}}),
        (6.0, 6.8, {"ojos": {"Mirar_Abajo": 1}, "cabeza": {"asentir": 6}}),
        (11.2, 12.4, E["alegria"]),
        (12.8, 14.0, E["sorpresa"]),
        (14.4, 15.8, E["tristeza"]),
        (16.2, 17.0, E["guino"]),
    ]
    attention_t = 7.4                  # llega un mensaje
    talk = (8.4, 10.8)
    syllables = make_syllables(*talk, rng)
    end = 18.5

    blinks, t = [], 0.8
    while t < end:
        busy = any(a - 0.3 < t < b + 0.4 for a, b, _ in events[4:])
        if not busy:
            blinks.append(t)
        t += rng.uniform(2.2, 4.8)
    blinks += [1.45, 3.25, 8.3]        # parpadear al cambiar la mirada o antes de hablar

    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, int(end * FPS)

    pivot = bpy.data.objects["Pivote_Cabeza"]
    root = bpy.data.objects["Maximilian23"]
    antenna = bpy.data.objects["Antena"]
    ant_base = antenna.rotation_euler.copy()
    all_keys = [(ob, kb.name) for ob in EYES + ("Boca",) for kb in keys(ob)[1:]]

    # muelle de la antena (angulos en grados)
    ax = ay = vx = vy = 0.0
    prev = None
    omega, zeta, dt = 14.0, 0.18, 1 / FPS

    for f in range(sc.frame_start, sc.frame_end + 1):
        t = (f - 1) / FPS
        pitch, roll, yaw, lift = idle_motion(t)
        face = {}
        for t0, t1, state in events:
            w = envelope(t, t0, t1)
            if w > 0:
                apply_face(state, w, face)
                p, r, y = head_angles(state, envelope(t, t0 + 0.1, t1, 0.45, 0.5))
                pitch, roll, yaw = pitch + p, roll + r, yaw + y

        # atencion: sube y mira con un pequeno rebote amortiguado
        x = t - attention_t
        if x >= 0:
            spring = math.exp(-3.2 * x) * math.sin(9.0 * x)
            pitch -= 7 * spring + 4 * envelope(t, attention_t, attention_t + 0.6, 0.15, 0.6)
            lift += 0.05 * envelope(t, attention_t, attention_t + 0.4, 0.15, 0.7)
            apply_face({"ojos": {"Sorpresa": 0.5}}, envelope(t, attention_t, attention_t + 0.5, 0.1, 0.4), face)

        # habla: boca por silabas, sonrisa leve y pequenos giros que acompanan
        if talk[0] - 0.3 < t < talk[1] + 0.5:
            for key, w in speech_weights(t, syllables).items():
                face[("Boca", key)] = face.get(("Boca", key), 0.0) + w
            k = envelope(t, talk[0], talk[1], 0.3, 0.5)
            yaw += k * 4 * math.sin(2 * math.pi * t / 2.3)
            pitch += k * 1.5 * math.sin(2 * math.pi * t / 0.9)

        bw = blink_weight(t, blinks)
        for ob in EYES:
            face[(ob, "Parpadeo")] = max(face.get((ob, "Parpadeo"), 0.0), bw)

        for ob, key in all_keys:
            kb = keys(ob)[key]
            kb.value = min(face.get((ob, key), 0.0), 1.0)
            kb.keyframe_insert("value", frame=f)

        pivot.rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw))
        pivot.keyframe_insert("rotation_euler", frame=f)
        root.location = (0, 0, lift)
        root.keyframe_insert("location", frame=f)

        # la antena se retrasa respecto a la cabeza y oscila un poco
        vel = (0.0, 0.0) if prev is None else ((pitch - prev[0]) / dt, (roll - prev[1]) / dt)
        prev = (pitch, roll)
        tx, ty = -0.04 * vel[0], -0.04 * vel[1]
        vx += (-omega ** 2 * (ax - tx) - 2 * zeta * omega * vx) * dt
        vy += (-omega ** 2 * (ay - ty) - 2 * zeta * omega * vy) * dt
        ax, ay = ax + vx * dt, ay + vy * dt
        antenna.rotation_euler = (ant_base.x + math.radians(ax), ant_base.y + math.radians(ay), ant_base.z)
        antenna.keyframe_insert("rotation_euler", frame=f)


def render_video(out_dir):
    sc = bpy.context.scene
    setup_cycles(480, 8)
    set_camera((-1.3, -5.2, 0.8), 55)
    s = sc.render.image_settings
    if hasattr(s, "media_type"):       # Blender 5
        s.media_type = "VIDEO"
    s.file_format = "FFMPEG"
    sc.render.ffmpeg.format = "MPEG4"
    sc.render.ffmpeg.codec = "H264"
    sc.render.ffmpeg.constant_rate_factor = "HIGH"
    sc.render.filepath = os.path.join(out_dir, "demo_fase2.mp4")
    bpy.ops.render.render(animation=True)
    print("Video:", sc.render.filepath)


def main():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--expr", required=True)
    p.add_argument("--sheet", action="store_true")
    p.add_argument("--video", action="store_true")
    args = p.parse_args(argv)

    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    with open(args.expr, encoding="utf-8") as fh:
        expr = json.load(fh)

    if args.sheet:
        render_sheet(expr, out)
    build_demo(expr)
    demo_blend = os.path.join(os.path.dirname(bpy.data.filepath), "maximilian23_demo.blend")
    set_camera((-1.3, -5.2, 0.8), 55)
    bpy.ops.wm.save_as_mainfile(filepath=demo_blend, copy=True)
    print("Demo blend:", demo_blend)
    if args.video:
        render_video(out)


main()
