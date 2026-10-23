"""
MAXIMILIAN 23 - Cabeza 3D (fases 1 y 2)
=======================================
Construye la cabeza de Maximilian 23 a partir de la referencia Cabeza.png,
con las expresiones de ojos y boca como shape keys (morph targets en el .glb)
y un pivote de cuello (Pivote_Cabeza) para los movimientos.

Uso desde la linea de comandos (recomendado):
    blender --background --python maximilian_head.py -- --out <carpeta> [--glb <ruta.glb>] [--render]

    --out     carpeta donde se guardan maximilian23.blend y renders/
    --glb     ruta del .glb exportado (por defecto <out>/maximilian23.glb)
    --render  genera vistas de comprobacion en <out>/renders/

Uso dentro de Blender: pestana Scripting > Open > Run Script.
En ese modo solo construye la escena (no guarda ni exporta).

Ejes: la cara mira hacia -Y, +Z es arriba, +X es el lado izquierdo del robot
(derecha del espectador). Unidad: radio horizontal de la cabeza = 1.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

# --------------------------------------------------------------------------
# Proporciones medidas sobre la referencia
# --------------------------------------------------------------------------
RX, RY, RZ = 1.0, 0.88, 0.80          # carcasa: mas ancha que alta

D = math.radians
VIS_A, VIS_B = D(54), D(29)           # semiancho / semialto del visor (angulos)
VIS_PHC = D(-7)                       # elevacion del centro del visor
VIS_N = 3.0                           # superelipse: 2 = elipse, >2 = mas cuadrado
SCREEN_OFF, SCREEN_BULGE = 0.03, 0.03 # separacion de la pantalla y abombado central

EYE_TH, EYE_PH = D(21), D(-1)         # centro de cada ojo (azimut +/-, elevacion)
EYE_A, EYE_B, EYE_N = D(5.3), D(10), 2.6
MOUTH_PH, MOUTH_HW = D(-23), D(10)    # boca: elevacion y semiancho
MOUTH_HT, MOUTH_CURVE = D(1.8), D(4)
GLOW_LIFT = 0.006                     # ojos y boca, sobre la pantalla

EAR_X0, EAR_Y, EAR_Z = 0.94, 0.08, -0.05
EAR_SCALE = 1.12                      # escala radial del perfil del auricular
EAR_SEAM_R = 0.45
CHIN_SEAM_Z = -0.63

NECK = Vector((0.0, 0.05, -0.45))     # pivote de los movimientos de cabeza

PANEL_R = (0.40, 0.55, 0.22)         # panel superior (radios) y su centro
PANEL_C = (0.0, 0.0, 0.61)

ANT_X, ANT_Y = -0.10, 0.04            # antena casi centrada, apenas a la derecha del robot
ANT_DIR = Vector((-0.10, 0.03, 1.0)).normalized()
ANT_LEN, ANT_ROD_R, ANT_BALL_R = 0.38, 0.026, 0.09

PALETTE = {
    "shell": "#2a4f58",
    "shell_light": "#35626b",
    "shell_dark": "#132429",
    "screen": "#04080a",
    "copper": "#d2691e",
    "glow": "#3fe0d0",
    "orange": "#f0892a",
    "cream": "#f3e7c9",
}


def col(hexstr, alpha=1.0):
    """Hex sRGB -> RGBA lineal (lo que esperan los materiales de Blender)."""
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, alpha)


# --------------------------------------------------------------------------
# Escena y materiales
# --------------------------------------------------------------------------
def clean_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                  bpy.data.cameras, bpy.data.curves, bpy.data.worlds):
        for b in list(block):
            block.remove(b)


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def set_input(node, names, value):
    # Los nombres de entrada cambiaron en Blender 4.0 (Emission -> Emission Color, ...)
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0,
             coat_roughness=0.1, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:  # Blender < 5 no crea los nodos por defecto
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    set_input(bsdf, ["Base Color"], color)
    set_input(bsdf, ["Metallic"], metallic)
    set_input(bsdf, ["Roughness"], roughness)
    set_input(bsdf, ["Coat Weight", "Clearcoat"], coat)
    set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], coat_roughness)
    if emission:
        set_input(bsdf, ["Emission Color", "Emission"], emission)
        set_input(bsdf, ["Emission Strength"], strength)
    m.diffuse_color = color
    return m


def build_materials():
    P = PALETTE
    return {
        "shell": material("Carcasa", col(P["shell"]), metallic=0.55, roughness=0.38, coat=0.35),
        "shell_light": material("Carcasa_Clara", col(P["shell_light"]), metallic=0.55, roughness=0.34, coat=0.4),
        "shell_dark": material("Carcasa_Oscura", col(P["shell_dark"]), metallic=0.4, roughness=0.55),
        "screen": material("Pantalla", col(P["screen"]), roughness=0.12, coat=1.0, coat_roughness=0.05),
        "copper": material("Borde_Cobre", col(P["copper"]), metallic=0.6, roughness=0.38),
        "glow": material("Luz_Turquesa", col(P["glow"]), roughness=0.4,
                         emission=col(P["glow"]), strength=1.3),
        "orange": material("Naranja", col(P["orange"]), metallic=0.2, roughness=0.3, coat=0.5),
        "led": material("LED_Naranja", col(P["orange"]), roughness=0.4,
                        emission=col(P["orange"]), strength=1.0),
        "cream": material("Luz_Pecho", col(P["cream"]), roughness=0.4,
                          emission=col(P["cream"]), strength=1.1),
    }


def make_obj(name, verts, faces, mats, coll, mat_idx=None, smooth=True, parent=None,
             loc=(0, 0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for m in mats:
        me.materials.append(m)
    if mat_idx:
        me.polygons.foreach_set("material_index", mat_idx)
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def make_empty(name, coll, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = 0.3
    coll.objects.link(ob)
    ob.parent = parent
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def z_to(direction):
    """Rotacion que lleva el eje Z local a 'direction'."""
    return Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized()).to_euler()


# --------------------------------------------------------------------------
# Geometria
# --------------------------------------------------------------------------
def ell_point(th, ph):
    """Punto de la carcasa. th = azimut (0 = frente), ph = elevacion."""
    return Vector((RX * math.cos(ph) * math.sin(th),
                   -RY * math.cos(ph) * math.cos(th),
                   RZ * math.sin(ph)))


def ell_normal(p):
    return Vector((p.x / RX ** 2, p.y / RY ** 2, p.z / RZ ** 2)).normalized()


def bulge(th, ph):
    u = th / VIS_A
    v = (ph - VIS_PHC) / VIS_B
    return SCREEN_OFF + SCREEN_BULGE * max(0.0, 1 - u * u) * max(0.0, 1 - v * v)


def screen_point(th, ph, extra=0.0):
    p = ell_point(th, ph)
    return p + ell_normal(p) * (bulge(th, ph) + extra)


def superellipse(t, a, b, n):
    c, s = math.cos(t), math.sin(t)
    return (a * math.copysign(abs(c) ** (2 / n), c),
            b * math.copysign(abs(s) ** (2 / n), s))


def ellipsoid_mesh(rx, ry, rz, rings=32, segs=64):
    verts = [Vector((0, 0, -rz))]
    for i in range(1, rings):
        ph = -math.pi / 2 + math.pi * i / rings
        for j in range(segs):
            th = 2 * math.pi * j / segs
            verts.append(Vector((rx * math.cos(ph) * math.sin(th),
                                 -ry * math.cos(ph) * math.cos(th),
                                 rz * math.sin(ph))))
    verts.append(Vector((0, 0, rz)))
    top = len(verts) - 1
    faces = [(0, 1 + (j + 1) % segs, 1 + j) for j in range(segs)]
    for i in range(rings - 2):
        r0, r1 = 1 + i * segs, 1 + (i + 1) * segs
        for j in range(segs):
            jn = (j + 1) % segs
            faces.append((r0 + j, r0 + jn, r1 + jn, r1 + j))
    r0 = 1 + (rings - 2) * segs
    faces += [(r0 + j, r0 + (j + 1) % segs, top) for j in range(segs)]
    return verts, faces


def lathe(profile, segs=48):
    """Revoluciona un perfil [(r, h, mat), ...] (de dentro afuera) sobre el eje Z local."""
    verts, faces, mats, rows = [], [], [], []
    for r, h, _ in profile:
        if r < 1e-6:
            rows.append([len(verts)])
            verts.append(Vector((0, 0, h)))
            continue
        row = []
        for j in range(segs):
            a = 2 * math.pi * j / segs
            row.append(len(verts))
            verts.append(Vector((r * math.cos(a), r * math.sin(a), h)))
        rows.append(row)
    for k in range(len(rows) - 1):
        A, B, m = rows[k], rows[k + 1], profile[k + 1][2]
        for j in range(segs):
            jn = (j + 1) % segs
            if len(A) == 1:
                faces.append((A[0], B[j], B[jn]))
            else:
                faces.append((A[j], B[j], B[jn], A[jn]))
            mats.append(m)
    return verts, faces, mats


def surface_patch(cth, cph, shape, n, extra, K=96, R=8):
    """Superficie pegada a la pantalla, en anillos concentricos de una superelipse unidad.

    shape(x, y) -> (dth, dph) deforma el contorno unidad en angulos. Con la misma K y R
    la topologia no cambia, asi que distintas 'shape' sirven como shape keys.
    """
    def point(x, y):
        dth, dph = shape(x, y)
        return screen_point(cth + dth, cph + dph, extra)

    verts = [point(0.0, 0.0)]
    rows = []
    for k in range(1, R + 1):
        s = k / R
        row = []
        for i in range(K):
            x, y = superellipse(2 * math.pi * i / K, 1, 1, n)
            row.append(len(verts))
            verts.append(point(s * x, s * y))
        rows.append(row)
    faces = [(0, rows[0][i], rows[0][(i + 1) % K]) for i in range(K)]
    for k in range(R - 1):
        A, B = rows[k], rows[k + 1]
        for i in range(K):
            i2 = (i + 1) % K
            faces.append((A[i], B[i], B[i2], A[i2]))
    return verts, faces


def sweep_closed(points, normals, w, h, seg=12, n=2.0, lift=0.0):
    """Tubo cerrado a lo largo de 'points'. Seccion superelipse: w en la superficie, h en la normal."""
    K = len(points)
    verts, faces = [], []
    for i in range(K):
        P, N = points[i], normals[i]
        T = (points[(i + 1) % K] - points[i - 1]).normalized()
        B = T.cross(N).normalized()
        N2 = B.cross(T).normalized()
        C = P + N2 * lift
        for j in range(seg):
            cu, cv = superellipse(2 * math.pi * j / seg, w, h, n)
            verts.append(C + B * cu + N2 * cv)
    for i in range(K):
        i2 = (i + 1) % K
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((i * seg + j, i2 * seg + j, i2 * seg + j2, i * seg + j2))
    return verts, faces


def shell_ring(func, K=96):
    pts = [func(2 * math.pi * i / K) for i in range(K)]
    return pts, [ell_normal(p) for p in pts]


def ear_seam_point(side):
    def f(a):
        y = EAR_Y + EAR_SEAM_R * math.cos(a)
        z = EAR_Z + EAR_SEAM_R * math.sin(a)
        x = RX * math.sqrt(max(0.0, 1 - (y / RY) ** 2 - (z / RZ) ** 2))
        return Vector((side * x, y, z))
    return f


def chin_seam_point(a):
    k = math.sqrt(1 - (CHIN_SEAM_Z / RZ) ** 2)
    return Vector((RX * k * math.sin(a), -RY * k * math.cos(a), CHIN_SEAM_Z))


def mouth_mesh(shape, N=40, rows=(-1, -0.5, 0, 0.5, 1)):
    """Cinta de N+1 columnas. shape(s) -> (dth, borde_sup, borde_inf) para s en [-1, 1]."""
    verts, faces = [], []
    R = len(rows)
    for i in range(N + 1):
        s = -1 + 2 * i / N
        th, top, bot = shape(s)
        for v in rows:
            verts.append(screen_point(th, MOUTH_PH + bot + (v + 1) / 2 * (top - bot), GLOW_LIFT))
    for i in range(N):
        for r in range(R - 1):
            faces.append((i * R + r, (i + 1) * R + r, (i + 1) * R + r + 1, i * R + r + 1))
    return verts, faces


# --------------------------------------------------------------------------
# Expresiones (shape keys). Ojos y boca son trazos luminosos sobre la pantalla:
# cada forma es la misma malla con los vertices recolocados.
# --------------------------------------------------------------------------
LOOK_TH, LOOK_PH = D(7), D(5)


def eye_shapes(side):
    """side = +1 ojo izquierdo del robot (+X), -1 ojo derecho. 'Mirar_Derecha' = derecha del espectador."""
    a, b = EYE_A, EYE_B

    def sad(x, y):
        outer = (side * x + 1) / 2   # 1 en el lado exterior del ojo
        return a * 1.05 * x, b * 0.85 * y - b * 0.1 - b * 0.6 * max(y, 0.0) * outer

    return {
        "Basis": lambda x, y: (a * x, b * y),
        "Parpadeo": lambda x, y: (a * 1.15 * x, b * 0.08 * y - b * 0.12),
        "Alegre": lambda x, y: (a * 1.3 * x, b * (0.55 * (1 - x * x) - 0.3) + b * 0.2 * y),
        "Sorpresa": lambda x, y: (a * 1.25 * x, b * 1.15 * y + b * 0.05),
        "Triste": sad,
        "Mirar_Derecha": lambda x, y: (a * x + LOOK_TH, b * y),
        "Mirar_Izquierda": lambda x, y: (a * x - LOOK_TH, b * y),
        "Mirar_Arriba": lambda x, y: (a * x, b * y + LOOK_PH),
        "Mirar_Abajo": lambda x, y: (a * x, b * y - LOOK_PH),
    }


def _taper(s):
    return 0.45 + 0.55 * math.sqrt(max(0.0, 1 - s ** 4))


def _round(s):
    return math.sqrt(max(0.0, 1 - s * s))


def _line(hw, curve, thick, lift=0.0):
    """Trazo fino curvado (curve > 0 sonrie, < 0 frunce)."""
    def f(s):
        c = lift + curve * s * s
        t = thick * _taper(s)
        return s * hw, c + t, c - t
    return f


def _open(hw, curve, drop):
    """Boca abierta en forma de D: borde superior curvado y el inferior desciende."""
    def f(s):
        top = curve * s * s + MOUTH_HT * _taper(s)
        return s * hw, top, top - 2 * MOUTH_HT * _taper(s) - drop * _round(s)
    return f


def _oval(hw, h, lift):
    def f(s):
        return s * hw, lift + h * _round(s), lift - h * _round(s)
    return f


MOUTH_SHAPES = {
    "Basis": _line(MOUTH_HW, MOUTH_CURVE, MOUTH_HT),
    "Sonrisa": _line(MOUTH_HW * 1.2, MOUTH_CURVE * 2.0, MOUTH_HT * 1.2),
    "Neutra": _line(MOUTH_HW * 0.8, MOUTH_CURVE * 0.15, MOUTH_HT),
    "Triste": _line(MOUTH_HW * 0.8, -MOUTH_CURVE * 1.1, MOUTH_HT, lift=D(1.5)),
    "Habla_A": _open(MOUTH_HW * 0.85, MOUTH_CURVE * 0.5, D(8.5)),
    "Habla_E": _open(MOUTH_HW * 1.0, MOUTH_CURVE * 0.6, D(4.5)),
    "Habla_O": _oval(MOUTH_HW * 0.5, D(5), D(-0.5)),
    "Sorpresa": _oval(MOUTH_HW * 0.62, D(7), D(-2)),
}


def add_shape_keys(ob, variants):
    """variants: {nombre: lista de vertices} con el mismo orden que la malla base."""
    ob.shape_key_add(name="Basis", from_mix=False)
    for name, verts in variants.items():
        kb = ob.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set("co", [c for v in verts for c in v])
        kb.value = 0.0          # Blender 5 las crea activas; el .glb exporta este peso inicial
    ob.data.shape_keys.use_relative = True


EAR_PROFILE = [  # (radio, altura sobre la base, material 0=carcasa 1=oscuro)
    (0.000, 0.125, 1), (0.070, 0.130, 1), (0.110, 0.150, 1), (0.125, 0.165, 1),
    (0.145, 0.165, 0), (0.160, 0.150, 0), (0.175, 0.150, 1), (0.190, 0.180, 0),
    (0.225, 0.185, 0), (0.240, 0.165, 0), (0.258, 0.165, 1), (0.275, 0.200, 0),
    (0.320, 0.195, 0), (0.348, 0.160, 0), (0.360, 0.100, 0), (0.355, 0.000, 0),
    (0.330, -0.120, 0),
]


def build_head(M, coll):
    # Pivote_Cabeza esta en el "cuello": asentir e inclinar giran desde abajo, no desde el centro
    root = make_empty("Maximilian23", coll)
    pivot = make_empty("Pivote_Cabeza", coll, parent=root, loc=NECK)
    head = make_empty("Cabeza", coll, parent=pivot, loc=-NECK)

    v, f = ellipsoid_mesh(RX, RY, RZ, rings=28, segs=56)
    make_obj("Carcasa", v, f, [M["shell"]], coll, parent=head)

    v, f = ellipsoid_mesh(*PANEL_R, rings=16, segs=40)
    make_obj("Panel_Superior", v, f, [M["shell_light"]], coll, parent=head, loc=PANEL_C)

    pts, nrm = shell_ring(chin_seam_point)
    v, f = sweep_closed(pts, nrm, 0.012, 0.012, seg=6, lift=-0.006)
    make_obj("Junta_Inferior", v, f, [M["shell_dark"]], coll, parent=head)

    # Visor: pantalla, borde de cobre, ojos y boca
    v, f = surface_patch(0.0, VIS_PHC, lambda x, y: (VIS_A * x, VIS_B * y), VIS_N, 0.0, K=96, R=6)
    make_obj("Pantalla", v, f, [M["screen"]], coll, parent=head)

    rim_pts, rim_nrm = [], []
    for i in range(96):
        du, dv = superellipse(2 * math.pi * i / 96, VIS_A, VIS_B, VIS_N)
        p = screen_point(du, VIS_PHC + dv)
        rim_pts.append(p)
        rim_nrm.append(ell_normal(ell_point(du, VIS_PHC + dv)))
    v, f = sweep_closed(rim_pts, rim_nrm, 0.05, 0.033, seg=12, n=3.0, lift=0.004)
    make_obj("Borde_Visor", v, f, [M["copper"]], coll, parent=head)

    for name, side in (("Ojo_L", 1), ("Ojo_R", -1)):
        shapes = eye_shapes(side)
        meshes = {k: surface_patch(side * EYE_TH, EYE_PH, fn, EYE_N, GLOW_LIFT, K=48, R=4)
                  for k, fn in shapes.items()}
        v, f = meshes.pop("Basis")
        eye = make_obj(name, v, f, [M["glow"]], coll, parent=head)
        add_shape_keys(eye, {k: mv for k, (mv, _) in meshes.items()})

    meshes = {k: mouth_mesh(fn) for k, fn in MOUTH_SHAPES.items()}
    v, f = meshes.pop("Basis")
    mouth = make_obj("Boca", v, f, [M["glow"]], coll, parent=head)
    add_shape_keys(mouth, {k: mv for k, (mv, _) in meshes.items()})

    # Modulos laterales (auriculares)
    ev, ef, em = lathe([(r * EAR_SCALE, h, m) for r, h, m in EAR_PROFILE], segs=40)
    for suffix, side in (("L", 1), ("R", -1)):
        make_obj(f"Auricular_{suffix}", ev, ef, [M["shell"], M["shell_dark"]], coll,
                 mat_idx=em, parent=head,
                 loc=(side * EAR_X0, EAR_Y, EAR_Z), rot=z_to((side, 0, 0)))
        pts, nrm = shell_ring(ear_seam_point(side))
        v, f = sweep_closed(pts, nrm, 0.011, 0.011, seg=6, lift=-0.005)
        make_obj(f"Junta_Auricular_{suffix}", v, f, [M["shell_dark"]], coll, parent=head)
        lv, lf = ellipsoid_mesh(0.032, 0.032, 0.032, rings=8, segs=16)
        make_obj(f"LED_{suffix}", lv, lf, [M["led"]], coll, parent=head,
                 loc=(side * (EAR_X0 + 0.20), EAR_Y - 0.165 * EAR_SCALE, EAR_Z + 0.24 * EAR_SCALE))

    # Antena
    # Se apoya sobre la carcasa o sobre el panel superior, lo que este mas alto
    zs = RZ * math.sqrt(1 - (ANT_X / RX) ** 2 - (ANT_Y / RY) ** 2)
    k = 1 - ((ANT_X - PANEL_C[0]) / PANEL_R[0]) ** 2 - ((ANT_Y - PANEL_C[1]) / PANEL_R[1]) ** 2
    if k > 0:
        zs = max(zs, PANEL_C[2] + PANEL_R[2] * math.sqrt(k))
    base = Vector((ANT_X, ANT_Y, zs)) - ANT_DIR * 0.02
    ant = make_empty("Antena", coll, parent=head, loc=base, rot=z_to(ANT_DIR))
    v, f, m = lathe([(0, 0.07, 0), (0.05, 0.07, 0), (0.07, 0.055, 0), (0.075, 0.03, 0),
                     (0.075, -0.06, 0)], segs=32)
    make_obj("Antena_Base", v, f, [M["shell_dark"]], coll, mat_idx=m, parent=ant)
    v, f, m = lathe([(0, ANT_LEN, 0), (ANT_ROD_R, ANT_LEN, 0), (ANT_ROD_R, 0.0, 0)], segs=16)
    make_obj("Antena_Varilla", v, f, [M["shell_dark"]], coll, mat_idx=m, parent=ant)
    v, f = ellipsoid_mesh(ANT_BALL_R, ANT_BALL_R, ANT_BALL_R, rings=16, segs=32)
    make_obj("Antena_Bola", v, f, [M["orange"]], coll, parent=ant,
             loc=(0, 0, ANT_LEN + ANT_BALL_R * 0.75))
    return root


# --------------------------------------------------------------------------
# Cuerpo entero, segun el poster (max.png). Cuelga de la raiz, no de la cabeza:
# la cabeza conserva su posicion y su animacion.
# Brazos y piernas son piezas rigidas articuladas con empties (hombro > codo > muneca,
# cadera > rodilla > tobillo) que el visor web gira directamente; sin esqueleto ni pesos.
# --------------------------------------------------------------------------
WAIST = Vector((0.0, 0.0, -2.3))      # pivote de respiracion y balanceo del tronco
# pecho: ancho en los hombros, se estrecha hacia la cintura y es mas plano por delante
CHEST_PROFILE = [(0.0, -0.9), (0.4, -0.92), (0.68, -1.0), (0.82, -1.1), (0.86, -1.28),
                 (0.84, -1.5), (0.77, -1.75), (0.68, -1.95), (0.58, -2.08), (0.42, -2.14), (0.2, -2.16)]
CHEST_DEPTH = 0.7
SHOULDER = (0.95, 0.0, -1.12)         # articulacion del hombro izquierdo (x se refleja)
HAND = 2.0                            # escala de la mano (manos grandes, de dibujo animado)
ARM_OUT_REST = D(12)                  # brazos algo separados del pecho en reposo
UPPER_LEN, FORE_LEN = 0.7, 0.66       # las manos llegan a la cadera, como en el poster
CHEST_LIGHT_Z = -1.45
PELVIS_DEPTH = 0.78                   # la cadera es mas plana de delante a atras que de lado
HIP = (0.42, 0.0, -2.72)              # articulacion de la cadera izquierda, metida en la cadera
LEG = 1.22                            # grosor de piernas y pies
THIGH_LEN, SHIN_LEN = 0.8, 0.86
FOOT_OUT = D(8)                       # puntas de los pies algo hacia fuera
FLOOR_Z = HIP[2] - THIGH_LEN - SHIN_LEN - 0.5


def capsule(r, length, segs=16):
    """Capsula a lo largo de +Z local, de 0 a length (base abierta, va metida en otra pieza)."""
    prof = [(0.0, length, 0), (r * 0.7, length - r * 0.3, 0), (r, length - r, 0), (r, r * 0.5, 0),
            (r * 0.8, 0.0, 0)]
    v, f, _ = lathe(prof, segs=segs)
    return v, f


def build_arm(M, coll, body, side):
    s = "L" if side > 0 else "R"
    shoulder = make_empty(f"Hombro_{s}", coll, parent=body,
                          loc=(side * SHOULDER[0], SHOULDER[1], SHOULDER[2]),
                          rot=(0, -side * ARM_OUT_REST, 0))
    v, f = ellipsoid_mesh(0.19, 0.19, 0.19, rings=12, segs=24)
    make_obj(f"Hombro_Bola_{s}", v, f, [M["shell_dark"]], coll, parent=shoulder)
    # hombrera grande con franja de cobre, como en el poster
    v, f, m = lathe([(0.0, 0.24, 0), (0.14, 0.23, 0), (0.26, 0.17, 0), (0.33, 0.08, 0),
                     (0.36, -0.02, 0), (0.365, -0.03, 1), (0.365, -0.1, 1), (0.35, -0.12, 0),
                     (0.3, -0.15, 0), (0.2, -0.16, 0)], segs=32)
    make_obj(f"Hombrera_{s}", v, f, [M["shell"], M["copper"]], coll, mat_idx=m, parent=shoulder,
             loc=(side * 0.05, 0, 0.06))
    v, f, m = lathe([(0.0, 0.0, 0), (0.1, -0.02, 0), (0.14, -0.08, 0), (0.14, -0.36, 0),
                     (0.152, -0.37, 1), (0.152, -0.43, 1), (0.14, -0.44, 0), (0.13, -0.6, 0),
                     (0.1, -0.66, 0), (0.05, -0.68, 0)], segs=24)
    make_obj(f"Brazo_{s}", v, f, [M["shell"], M["shell_dark"]], coll, mat_idx=m, parent=shoulder)

    elbow = make_empty(f"Codo_{s}", coll, parent=shoulder, loc=(0, 0, -UPPER_LEN), rot=(D(-8), 0, 0))
    v, f = ellipsoid_mesh(0.145, 0.145, 0.145, rings=12, segs=24)
    make_obj(f"Codo_Bola_{s}", v, f, [M["shell_dark"]], coll, parent=elbow)
    # antebrazo en forma de guantelete: se ensancha hacia la muneca
    v, f, m = lathe([(0.0, 0.0, 0), (0.1, -0.02, 0), (0.14, -0.08, 0), (0.16, -0.36, 0),
                     (0.175, -0.5, 0), (0.182, -0.51, 1), (0.182, -0.58, 1), (0.16, -0.6, 0),
                     (0.12, -0.64, 0), (0.07, -0.65, 0)], segs=24)
    make_obj(f"Antebrazo_{s}", v, f, [M["shell"], M["copper"]], coll, mat_idx=m, parent=elbow)

    # mano: palma hacia el cuerpo, cuatro dedos de dos falanges algo curvados y pulgar
    wrist = make_empty(f"Muneca_{s}", coll, parent=elbow, loc=(0, 0, -FORE_LEN))
    k = HAND
    # Palma de carcasa: seccion plana, bordes redondeados y muneca mas estrecha.
    v, f = ellipsoid_mesh(0.07 * k, 0.13 * k, 0.12 * k, rings=12, segs=24)
    shaped = []
    for x, y, z in v:
        # Superelipse suave: conserva la insercion de dedos y pulgar.
        nx, ny, nz = x / (0.07*k), y / (0.13*k), z / (0.12*k)
        flat_x = math.copysign(abs(nx) ** 0.4, nx) * (0.046*k)
        taper = 1.0 - 0.15 * max(0.0, nz)
        shaped.append((flat_x, math.copysign(abs(ny) ** 0.55, ny) * (0.13*k) * taper, math.copysign(abs(nz) ** 0.6, nz) * (0.12*k)))
    v = shaped
    make_obj(f"Palma_{s}", v, f, [M["shell"]], coll, parent=wrist, loc=(0, 0, -0.09 * k))
    for i, y in enumerate((-0.09, -0.03, 0.03, 0.09)):
        scale = 1.0 if i in (1, 2) else 0.88                      # los dedos centrales, mas largos
        base = Vector((-side * 0.01 * k, y * k, -0.18 * k))
        d1 = Vector((-side * 0.2, y * 0.5, -1.0)).normalized()
        d2 = Vector((-side * 0.7, y * 0.4, -1.0)).normalized()
        l1, l2 = 0.08 * k * scale, 0.07 * k * scale
        fv, ff = capsule(0.034 * k, l1 + 0.02 * k, segs=12)
        make_obj(f"Dedo_{s}{i + 1}a", fv, ff, [M["shell_dark"]], coll, parent=wrist,
                 loc=base, rot=z_to(d1))
        fv, ff = capsule(0.031 * k, l2, segs=12)
        make_obj(f"Dedo_{s}{i + 1}b", fv, ff, [M["shell_dark"]], coll, parent=wrist,
                 loc=base + d1 * l1, rot=z_to(d2))
    t1 = Vector((-side * 0.3, -0.8, -0.5)).normalized()
    t2 = Vector((-side * 0.6, -0.5, -0.65)).normalized()
    tbase = Vector((-side * 0.02 * k, -0.11 * k, -0.06 * k))
    tv, tf = capsule(0.038 * k, 0.08 * k, segs=12)
    make_obj(f"Pulgar_{s}a", tv, tf, [M["shell_dark"]], coll, parent=wrist, loc=tbase, rot=z_to(t1))
    tv, tf = capsule(0.034 * k, 0.065 * k, segs=12)
    make_obj(f"Pulgar_{s}b", tv, tf, [M["shell_dark"]], coll, parent=wrist,
             loc=tbase + t1 * 0.07 * k, rot=z_to(t2))
    return shoulder


def build_leg(M, coll, parent, side):
    s = "L" if side > 0 else "R"
    g = LEG
    hip = make_empty(f"Cadera_{s}", coll, parent=parent, loc=(side * HIP[0], HIP[1], HIP[2]))
    v, f = ellipsoid_mesh(0.21 * g, 0.21 * g, 0.21 * g, rings=12, segs=24)
    make_obj(f"Cadera_Bola_{s}", v, f, [M["shell_dark"]], coll, parent=hip)
    t = THIGH_LEN / 0.64        # el perfil se diseno para un muslo de 0.64
    v, f, m = lathe([(0.0, 0.0, 0), (0.14 * g, -0.02 * t, 0), (0.21 * g, -0.1 * t, 0),
                     (0.22 * g, -0.45 * t, 0), (0.2 * g, -0.56 * t, 0), (0.12 * g, -0.62 * t, 0)],
                    segs=24)
    make_obj(f"Muslo_{s}", v, f, [M["shell"]], coll, mat_idx=m, parent=hip)

    knee = make_empty(f"Rodilla_{s}", coll, parent=hip, loc=(0, 0, -THIGH_LEN))
    v, f = ellipsoid_mesh(0.19 * g, 0.19 * g, 0.19 * g, rings=12, segs=24)
    make_obj(f"Rodilla_Bola_{s}", v, f, [M["shell_dark"]], coll, parent=knee)
    # rodillera hexagonal naranja (un torno de 6 lados)
    v, f, m = lathe([(0.0, 0.07, 0), (0.15 * g, 0.07, 0), (0.2 * g, 0.025, 0), (0.2 * g, -0.06, 0)],
                    segs=6)
    make_obj(f"Rodillera_{s}", v, f, [M["copper"]], coll, mat_idx=m, parent=knee, smooth=False,
             loc=(0, -0.15 * g, 0.0), rot=z_to((0, -1, 0.12)))
    # espinilla que se ensancha hacia abajo, con franja de cobre sobre el pie
    v, f, m = lathe([(0.0, 0.0, 0), (0.14 * g, -0.03, 0), (0.2 * g, -0.12, 0), (0.23 * g, -0.5, 0),
                     (0.26 * g, -0.64, 0), (0.272 * g, -0.65, 1), (0.272 * g, -0.74, 1),
                     (0.26 * g, -0.76, 0), (0.22 * g, -0.83, 0), (0.12 * g, -0.86, 0)], segs=28)
    make_obj(f"Espinilla_{s}", v, f, [M["shell"], M["copper"]], coll, mat_idx=m, parent=knee)

    ankle = make_empty(f"Tobillo_{s}", coll, parent=knee, loc=(0, 0, -SHIN_LEN),
                       rot=(0, 0, side * FOOT_OUT))
    v, f = ellipsoid_mesh(0.15 * g, 0.15 * g, 0.15 * g, rings=10, segs=20)
    make_obj(f"Tobillo_Bola_{s}", v, f, [M["shell_dark"]], coll, parent=ankle)
    # pie redondeado tipo bota, con suela oscura apoyada en el suelo (z = FLOOR_Z)
    v, f = ellipsoid_mesh(0.29 * g, 0.46 * g, 0.2, rings=14, segs=28)
    make_obj(f"Pie_{s}", v, f, [M["shell"]], coll, parent=ankle, loc=(0, -0.14 * g, -0.3))
    v, f = ellipsoid_mesh(0.3 * g, 0.48 * g, 0.05, rings=8, segs=28)
    make_obj(f"Suela_{s}", v, f, [M["shell_dark"]], coll, parent=ankle, loc=(0, -0.14 * g, -0.45))
    return hip


def build_body(M, coll, root):
    pivot = make_empty("Pivote_Cuerpo", coll, parent=root, loc=WAIST)
    body = make_empty("Cuerpo", coll, parent=pivot, loc=-WAIST)

    # cuello: llega hasta el pivote de la cabeza, que gira sobre su extremo superior
    v, f, m = lathe([(0.0, NECK.z, 0), (0.18, NECK.z - 0.01, 0), (0.18, -1.0, 0)], segs=24)
    make_obj("Cuello", v, f, [M["shell_dark"]], coll, mat_idx=m, parent=body, loc=(0, NECK.y, 0))
    v, f, m = lathe([(0.2, -0.85, 0), (0.3, -0.86, 0), (0.36, -0.89, 0), (0.37, -0.93, 0),
                     (0.33, -0.97, 0), (0.25, -0.99, 0)], segs=32)
    make_obj("Collar", v, f, [M["shell_dark"]], coll, mat_idx=m, parent=body)

    v, f, m = lathe([(r, z, 0) for r, z in CHEST_PROFILE], segs=48)
    for p in v:
        p.y *= CHEST_DEPTH
    make_obj("Pecho", v, f, [M["shell"]], coll, mat_idx=m, parent=body)

    # luz del pecho: centro crema, anillo turquesa y aro de cobre, sobre la cara frontal
    zs = [z for _, z in CHEST_PROFILE]
    i = next(k for k in range(len(zs) - 1) if zs[k] >= CHEST_LIGHT_Z >= zs[k + 1])
    u = (CHEST_LIGHT_Z - zs[i]) / (zs[i + 1] - zs[i])
    y = -(CHEST_PROFILE[i][0] + u * (CHEST_PROFILE[i + 1][0] - CHEST_PROFILE[i][0])) * CHEST_DEPTH
    v, f, m = lathe([(0.0, 0.07, 0), (0.12, 0.065, 0), (0.15, 0.06, 1), (0.19, 0.055, 1),
                     (0.2, 0.075, 2), (0.26, 0.075, 2), (0.29, 0.04, 2), (0.29, -0.06, 2)], segs=48)
    make_obj("Luz_Pecho", v, f, [M["cream"], M["glow"], M["copper"]], coll, mat_idx=m, parent=body,
             loc=(0, y + 0.02, CHEST_LIGHT_Z), rot=z_to((0, -1, 0)))

    # abdomen con anillos, como un fuelle (oscuro en el poster)
    v, f, m = lathe([(0.0, -1.95, 0), (0.5, -1.95, 0), (0.62, -2.0, 0), (0.6, -2.05, 1),
                     (0.56, -2.08, 1), (0.63, -2.12, 0), (0.6, -2.17, 1), (0.56, -2.2, 1),
                     (0.62, -2.24, 0), (0.58, -2.3, 1), (0.4, -2.36, 1), (0.2, -2.38, 1)], segs=40)
    for p in v:
        p.y *= 0.82             # algo mas plano, para no sobresalir del pecho de perfil
    make_obj("Abdomen", v, f, [M["shell_dark"], M["shell"]], coll, mat_idx=m, parent=body)

    for side in (1, -1):
        build_arm(M, coll, body, side)

    # cadera y piernas: fijas a la raiz, el tronco se balancea encima sin mover los pies
    # cadera tipo "pantalon corto": estrecha arriba, se ensancha y se cierra por abajo,
    # con una franja oscura de union con el abdomen
    hips = make_empty("Pelvis", coll, parent=root)
    v, f, m = lathe([(0.0, -2.25, 0), (0.55, -2.25, 0), (0.6, -2.29, 1), (0.64, -2.34, 1),
                     (0.68, -2.36, 0), (0.75, -2.46, 0), (0.79, -2.58, 0), (0.78, -2.68, 0),
                     (0.72, -2.78, 0), (0.58, -2.85, 0), (0.35, -2.88, 0), (0.15, -2.89, 0)], segs=40)
    for p in v:
        p.y *= PELVIS_DEPTH
    make_obj("Cadera", v, f, [M["shell"], M["shell_dark"]], coll, mat_idx=m, parent=hips)
    for side in (1, -1):
        build_leg(M, coll, hips, side)
    return pivot


# --------------------------------------------------------------------------
# Iluminacion, camara, render y exportacion
# --------------------------------------------------------------------------
HEAD_TARGET, BODY_TARGET = (0, 0, 0.05), (0, 0, -1.75)
VIEWS = {  # nombre: (posicion de camara, punto al que mira)
    "tres_cuartos": ((-2.44, -4.59, 1.1), HEAD_TARGET),   # mismo angulo que Cabeza.png
    "cuerpo_tres_cuartos": ((-5.2, -10.4, 0.4), BODY_TARGET),
    "cuerpo_frente": ((0.0, -11.8, 0.0), BODY_TARGET),
    "cuerpo_perfil": ((-11.8, 0.0, -0.4), BODY_TARGET),
    "cuerpo_espalda": ((4.6, 10.8, 0.4), BODY_TARGET),
}


def track(ob, target):
    c = ob.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


def build_stage(coll):
    sc = bpy.context.scene
    target = make_empty("Objetivo", coll, loc=HEAD_TARGET)

    for name, loc, energy, size in (("Luz_Principal", (-3.5, -4.0, 3.5), 650, 3.0),
                                    ("Luz_Relleno", (4.0, -3.0, 0.5), 220, 4.0),
                                    ("Luz_Contra", (1.5, 4.5, 3.5), 450, 2.5)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size = energy, size
        ob = bpy.data.objects.new(name, ld)
        coll.objects.link(ob)
        ob.location = loc
        track(ob, target)

    world = bpy.data.worlds.new("Fondo")
    if world.node_tree is None:
        world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = col("#0d1b22")
    bg.inputs["Strength"].default_value = 0.6
    sc.world = world

    # suelo solo para los renders (no se exporta): recoge la sombra de los pies
    v, f = [(-8, -8, FLOOR_Z), (8, -8, FLOOR_Z), (8, 8, FLOOR_Z), (-8, 8, FLOOR_Z)], [(0, 1, 2, 3)]
    make_obj("Suelo", v, f, [material("Suelo", col("#10232a"), roughness=0.9)], coll, smooth=False)

    cam_data = bpy.data.cameras.new("Camara")
    cam_data.lens = 55
    cam = bpy.data.objects.new("Camara", cam_data)
    coll.objects.link(cam)
    cam.location = VIEWS["tres_cuartos"][0]
    track(cam, target)
    sc.camera = cam

    # "Standard" evita que el tonemapping (AgX/Filmic) desature los colores originales
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.resolution_x = sc.render.resolution_y = 1000
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            sc.render.engine = engine
            break
        except TypeError:
            continue
    try:
        sc.eevee.taa_render_samples = 64
    except AttributeError:
        pass
    return cam


def render_views(cam, out_dir):
    # Cycles por CPU: Eevee puede bloquear Blender en graficas escolares sin OpenGL completo
    sc = bpy.context.scene
    engine = sc.render.engine
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_percentage = 70
    os.makedirs(out_dir, exist_ok=True)
    target = bpy.data.objects["Objetivo"]
    for name, (loc, aim) in VIEWS.items():
        cam.location = loc
        target.location = aim
        sc.render.filepath = os.path.join(out_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("Render:", sc.render.filepath)
    sc.render.engine = engine
    sc.render.resolution_percentage = 100
    cam.location, target.location = VIEWS["tres_cuartos"]


def export_glb(model_objects, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for ob in bpy.context.scene.objects:
        if ob is not None:
            ob.select_set(ob in model_objects)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_texcoords=False)   # sin texturas: las UV solo ocupan sitio
    print("GLB:", path)


def triangle_count(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs if o.type == "MESH")


def parse_args():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
    if argv is None:
        return None
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--glb")
    p.add_argument("--render", action="store_true")
    return p.parse_args(argv)


def main():
    args = parse_args()
    clean_scene()
    model_coll = new_collection("Maximilian23")
    stage_coll = new_collection("Escena")
    M = build_materials()
    root = build_head(M, model_coll)
    build_body(M, model_coll, root)
    cam = build_stage(stage_coll)

    model_objs = list(model_coll.objects)
    print(f"Maximilian 23: {len(model_objs)} objetos, {triangle_count(model_objs)} triangulos")
    if args is None:
        return

    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)
    export_glb(model_objs, os.path.abspath(args.glb or os.path.join(out, "maximilian23.glb")))
    if args.render:
        render_views(cam, os.path.join(out, "renders"))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "maximilian23.blend"))
    print("Blend:", os.path.join(out, "maximilian23.blend"))


main()
