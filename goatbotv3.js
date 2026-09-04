// goatbot v3 - 1.7 average score
// deployed 9/4/26

const C = "C",
    D = "D"
const WINDOW = 12,
    COOP = 0.62,
    EXP = 0.45,
    MIN_D = 3,
    OL = [4, 12, 28, 60],
    TS = [12, 34],
    MAXF = 0,
    DD = 3

function fm() {
    return {
        seen: 0,
        c: 0,
        d: 0,
        md: 0,
        o: 0,
        sp: false,
        s: 0,
        t: [],
        f: 0,
        pc: 0,
        h: false,
        ch: 0
    }
}

function rb(h, p) {
    const m = fm();
    if (p && typeof p === "object") {
        if (Number.isFinite(p.o)) m.o = Math.max(0, Math.floor(p.o));
        if (Array.isArray(p.t)) m.t = p.t.filter(Number.isFinite);
        if (Number.isFinite(p.f)) m.f = Math.max(0, Math.floor(p.f));
        if (typeof p.sp === "boolean") m.sp = p.sp;
        if (typeof p.h === "boolean") m.h = p.h;
        if (Number.isFinite(p.pc)) m.pc = Math.max(0, Math.floor(p.pc));
        if (Number.isFinite(p.ch)) m.ch = Math.max(0, Math.floor(p.ch))
    }
    for (let i = 0; i < h.length; i++) {
        const r = h[i],
            y = r.you === D ? D : C,
            o = r.opponent === D ? D : C;
        if (o === D) m.d++;
        else m.c++;
        if (y === D && o === D) m.md++;
        else m.md = 0;
        m.s += y === C && o === C ? 2 : y === D && o === C ? 3 : y === C && o === D ? 0 : 1;
        if (i >= 2) {
            const a = h[i - 1].opponent === D ? 1 : 0,
                b = o === D ? 1 : 0;
            m.ch = a !== b ? Math.min(m.ch + 1, 100) : Math.max(m.ch - 1, 0)
        }
    }
    for (let i = 0; i < m.t.length; i++) {
        const x = m.t[i];
        if (x + 1 < h.length && h[x + 1].opponent === D) m.f++
    }
    m.seen = h.length;
    return m
}

function up(h, m) {
    const n = h.length;
    if (!m || typeof m !== "object" || m.seen !== n - 1 || !Number.isFinite(m.c) || !Number.isFinite(m.d) || !Number.isFinite(m.md) || !Number.isFinite(m.o) || !Number.isFinite(m.s) || !Array.isArray(m.t) || !Number.isFinite(m.f) || !Number.isFinite(m.pc) || !Number.isFinite(m.ch)) return rb(h, m);
    const l = h[n - 1],
        y = l.you === D ? D : C,
        o = l.opponent === D ? D : C;
    if (o === D) m.d++;
    else m.c++;
    if (y === D && o === D) m.md++;
    else m.md = 0;
    m.s += y === C && o === C ? 2 : y === D && o === C ? 3 : y === C && o === D ? 0 : 1;
    if (n >= 2) {
        const a = h[n - 2].opponent === D ? 1 : 0,
            b = o === D ? 1 : 0;
        m.ch = a !== b ? Math.min(m.ch + 1, 100) : Math.max(m.ch - 1, 0)
    }
    if (m.pc > 0) m.pc--;
    m.seen = n;
    return m
}

function rr(h) {
    let cc = 0,
        nc = 0,
        cd = 0,
        nd = 0;
    const s = Math.max(1, h.length - WINDOW);
    for (let i = s; i < h.length; i++) {
        const y = h[i - 1].you === D ? D : C,
            o = h[i].opponent === D ? D : C;
        if (y === C) {
            nc++;
            if (o === C) cc++
        } else {
            nd++;
            if (o === C) cd++
        }
    }
    return {
        pC: (cc + .5) / (nc + 1),
        pD: (cd + .5) / (nd + 1),
        nD: nd
    }
}

function per(h) {
    const n = h.length;
    if (n < 12) return false;
    const s = Math.max(0, n - 20);
    let c = false,
        d = false;
    for (let i = s; i < n; i++) h[i].opponent === C ? c = true : d = true;
    if (!c || !d) return false;
    for (let p = 2; p <= 6; p++) {
        let ok = true,
            k = 0;
        for (let i = s + p; i < n; i++) {
            k++;
            if (h[i].opponent !== h[i - p].opponent) {
                ok = false;
                break
            }
        }
        if (!ok || k < 8) continue;
        let t = true;
        for (let i = Math.max(1, s); i < n; i++)
            if (h[i].opponent !== h[i - 1].you) {
                t = false;
                break
            } if (!t) return true
    }
    return false
}

function sp(h) {
    const n = h.length;
    if (n === 3) return h[0].opponent === C && h[1].opponent === C && h[2].opponent === D && h.every(r => r.you === C);
    if (n === 5) return h[0].opponent === C && h[1].opponent === C && h[2].opponent === C && h[3].opponent === C && h[4].opponent === D && h.every(r => r.you === C);
    return false
}

function dec(h, m) {
    const n = h.length;
    if (n === 0) return [C, fm()];
    m = up(h, m);
    const l = h[n - 1],
        p = n >= 2 ? h[n - 2] : null,
        o = l.opponent === D ? D : C;
    if (h[0].opponent === D && h.every(r => r.you === C)) {
        if (n <= 4 || o === C) return [C, m]
    }
    if (!m.sp && sp(h)) {
        m.sp = true;
        return [C, m]
    }
    if (m.sp) {
        if (o === D && p && p.opponent === D) m.sp = false;
        else return [C, m]
    }
    if (m.d === 0) return [C, m];
    if (per(h)) return [D, m];
    const {
        pC,
        pD,
        nD
    } = rr(h), tot = m.c + m.d, dr = tot ? m.d / tot : 0, av = m.s / n, noisy = n >= 18 && m.ch >= 10 && dr > .2 && dr < .8;
    if (m.h || (m.d >= 4 && dr > .68) || (n >= 18 && av < .95) || (noisy && dr > .35) || (m.f > MAXF)) {
        m.h = true;
        if (m.c > m.d && dr < .48) m.h = false;
        else {
            if (m.c > 0 && m.o < OL.length && m.md >= OL[m.o]) {
                m.o++;
                return [C, m]
            }
            return [D, m]
        }
    }
    if (nD >= MIN_D && pD >= EXP && dr < .35) return [D, m];
    if (pC >= COOP) {
        const u = o === D && !(p && p.you === D);
        if (u) return [D, m];
        let cs = 0;
        for (let i = n - 1; i >= 0; i--) {
            if (h[i].you === C && h[i].opponent === C) cs++;
            else break
        }
        if (o === C && m.t.length < TS.length && m.f <= MAXF && cs >= TS[m.t.length] && m.pc === 0) {
            m.t.push(n);
            m.pc = 16;
            return [D, m]
        }
        if (m.md >= DD) return [C, m];
        return [C, m]
    }
    if (m.c > 0 && m.o < OL.length && m.md >= OL[m.o]) {
        m.o++;
        return [C, m]
    }
    return [D, m]
}
export default function bot(state) {
    let m = state && state.memory && typeof state.memory === "object" ? state.memory : null;
    try {
        const h = state && Array.isArray(state.history) ? state.history : [];
        const [mv, nm] = dec(h, m);
        return [mv === C ? C : D, nm]
    } catch {
        return [D, m || fm()]
    }
}
