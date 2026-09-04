// goatbot v2 - 1.703 average score
// deployed 9/3/26

export default function bot({ history, memory }) {
  try {
    const C = "C", D = "D"
    if (memory == null || typeof memory !== "object" || !Array.isArray(memory.win)) {
      memory = { doom: false, nat: 0, dStrk: 0, cStrk: 0, oppC: 0, oppD: 0, win: [], dWin: [], late: [] }
    }
    if (!Array.isArray(memory.dWin)) memory.dWin = []
    if (!Array.isArray(memory.late)) memory.late = []

    const n = history.length
    if (n === 0) return [C, memory]

    const last = history[n - 1]
    const opp = last.opponent === D ? D : C
    const me = last.you === D ? D : C
    const prevMe = n >= 2 ? (history[n - 2].you === D ? D : C) : C

    memory.dStrk = opp === D ? memory.dStrk + 1 : 0
    memory.cStrk = opp === C ? memory.cStrk + 1 : 0
    if (opp === D) memory.oppD++; else memory.oppC++

    const unprovoked = opp === D && me === C && prevMe === C
    if (unprovoked) memory.nat++

    if (n >= 2) {
      memory.win.push(opp === prevMe ? 1 : 0)
      if (memory.win.length > 40) memory.win.shift()
    }
    if (n >= 2 && prevMe === C) {
      memory.dWin.push(opp === D ? 1 : 0)
      if (memory.dWin.length > 14) memory.dWin.shift()
    }

    const tot = memory.oppC + memory.oppD
    const oppDR = tot ? memory.oppD / tot : 0
    let reactivity = 0.5
    if (memory.win.length >= 10) {
      reactivity = memory.win.reduce((a, b) => a + b, 0) / memory.win.length
    }
    const looksRandom = memory.win.length >= 15 && reactivity < 0.62 && oppDR > 0.28

    if (memory.doom) {
      if (looksRandom) return [D, memory]
      if (memory.cStrk >= 3) { memory.doom = false; memory.nat = 0 }
      else return [D, memory]
    }
    if (memory.dStrk >= 2 && memory.nat >= 1) {
      memory.doom = true
      return [D, memory]
    }
    if (
      n >= 20 &&
      memory.dWin.length >= 14 &&
      memory.dWin.reduce((a, b) => a + b, 0) >= 5
    ) {
      memory.doom = true
      return [D, memory]
    }

    if (n >= 90) {
      memory.late.push(opp === D ? 1 : 0)
      if (memory.late.length > 12) memory.late.shift()
      if (memory.late.length >= 8 && memory.late.reduce((a, b) => a + b, 0) >= 3) {
        return [D, memory]
      }
    }

    if (opp === C) return [C, memory]
    if (me === D) return [C, memory]
    if (unprovoked) return [D, memory]
    return [C, memory]
  } catch (e) {
    try {
      if (history && history.length > 0) {
        return [history[history.length - 1].opponent === "D" ? "D" : "C", memory ?? null]
      }
    } catch (e2) {}
    return ["C", null]
  }
}