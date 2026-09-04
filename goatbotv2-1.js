// goatbot v2.1 - 1.698 average score
// deployed 9/3/26

const C = "C"
const D = "D"

const WINDOW = 12
const COOP_THRESHOLD = 0.58
const EXPLOIT_THRESHOLD = 0.39
const MIN_AFTER_D = 3
const OLIVE_SCHEDULE = [6, 18, 45]
const OPENING_PEACE_ROUNDS = 6

function baseMemory() {
  return {
    seen: 0,
    oppC: 0,
    oppD: 0,
    mutualDStreak: 0,
    olives: 0,
    probeDone: false,
    sparsePeace: false,
    sparseTag: 0,
    score: 0,
    dTests: 0,
    failedDTests: 0,
    grace: 0,
    hardLock: false
  }
}

function validMemory(m) {
  return m && typeof m === "object" && Number.isFinite(m.seen)
}

function rebuild(history, previous) {
  const m = baseMemory()
  if (previous && typeof previous === "object") {
    if (Number.isFinite(previous.olives)) m.olives = Math.max(0, Math.floor(previous.olives))
    if (typeof previous.probeDone === "boolean") m.probeDone = previous.probeDone
    if (typeof previous.sparsePeace === "boolean") m.sparsePeace = previous.sparsePeace
    if (Number.isFinite(previous.sparseTag)) m.sparseTag = previous.sparseTag
    if (Number.isFinite(previous.dTests)) m.dTests = previous.dTests
    if (Number.isFinite(previous.failedDTests)) m.failedDTests = previous.failedDTests
    if (Number.isFinite(previous.grace)) m.grace = previous.grace
    if (typeof previous.hardLock === "boolean") m.hardLock = previous.hardLock
  }

  for (let i = 0; i < history.length; i++) {
    const r = history[i]
    const y = r.you === D ? D : C
    const o = r.opponent === D ? D : C
    if (o === D) m.oppD++
    else m.oppC++
    if (y === D && o === D) m.mutualDStreak++
    else m.mutualDStreak = 0

    m.score +=
      y === C && o === C ? 2 :
      y === D && o === C ? 3 :
      y === C && o === D ? 0 : 1

    if (i >= 1 && history[i - 1].you === D && o === D) m.failedDTests++
  }

  m.seen = history.length
  return m
}

function update(history, memory) {
  const n = history.length
  if (!validMemory(memory) || memory.seen !== n - 1) return rebuild(history, memory)

  const last = history[n - 1]
  const y = last.you === D ? D : C
  const o = last.opponent === D ? D : C

  if (o === D) memory.oppD++
  else memory.oppC++

  if (y === D && o === D) memory.mutualDStreak++
  else memory.mutualDStreak = 0

  memory.score +=
    y === C && o === C ? 2 :
    y === D && o === C ? 3 :
    y === C && o === D ? 0 : 1

  if (n >= 2 && history[n - 2].you === D && o === D) memory.failedDTests++

  memory.seen = n
  return memory
}

function smoothed(a, b) {
  return (a + 0.5) / (b + 1)
}

function responseRates(history) {
  let cAfterC = 0, nAfterC = 0
  let cAfterD = 0, nAfterD = 0
  const start = Math.max(1, history.length - WINDOW)

  for (let i = start; i < history.length; i++) {
    const myPrev = history[i - 1].you === D ? D : C
    const oppNow = history[i].opponent === D ? D : C
    if (myPrev === C) {
      nAfterC++
      if (oppNow === C) cAfterC++
    } else {
      nAfterD++
      if (oppNow === C) cAfterD++
    }
  }

  return {
    pC: smoothed(cAfterC, nAfterC),
    pD: smoothed(cAfterD, nAfterD),
    nAfterD
  }
}

function isPeriodicUnconditional(history) {
  const n = history.length
  if (n < 12) return false
  const start = Math.max(0, n - 22)

  let sawC = false, sawD = false
  for (let i = start; i < n; i++) {
    if (history[i].opponent === C) sawC = true
    else sawD = true
  }
  if (!sawC || !sawD) return false

  for (let p = 2; p <= 6; p++) {
    let ok = true
    let checks = 0
    for (let i = start + p; i < n; i++) {
      checks++
      if (history[i].opponent !== history[i - p].opponent) {
        ok = false
        break
      }
    }
    if (!ok || checks < 8) continue

    let tftLike = true
    for (let i = Math.max(1, start); i < n; i++) {
      if (history[i].opponent !== history[i - 1].you) {
        tftLike = false
        break
      }
    }
    if (!tftLike) return true
  }

  return false
}

function detectSparsePrefix(history) {
  const n = history.length
  if (n >= 3) {
    if (
      history[0].opponent === C &&
      history[1].opponent === C &&
      history[2].opponent === D
    ) return 1
  }
  if (n >= 5) {
    if (
      history[0].opponent === C &&
      history[1].opponent === C &&
      history[2].opponent === C &&
      history[3].opponent === C &&
      history[4].opponent === D
    ) return 2
  }
  return 0
}

function decide(history, memory) {
  const n = history.length
  if (n === 0) return [C, baseMemory()]

  memory = update(history, memory)
  if (memory.grace > 0) memory.grace--

  const last = history[n - 1]
  const prev = n >= 2 ? history[n - 2] : null
  const oppLast = last.opponent === D ? D : C

  if (history[0].opponent === D && history.every(r => r.you === C)) {
    if (n <= OPENING_PEACE_ROUNDS) return [C, memory]
    if (oppLast === C) return [C, memory]
  }

  if (!memory.sparsePeace && history.every(r => r.you === C)) {
    const tag = detectSparsePrefix(history)
    if (tag > 0) {
      memory.sparsePeace = true
      memory.sparseTag = tag
      return [C, memory]
    }
  }

  if (memory.sparsePeace) {
    if (oppLast === D && prev && prev.opponent === D) {
      memory.sparsePeace = false
    } else {
      return [C, memory]
    }
  }

  if (memory.oppD === 0) return [C, memory]

  if (isPeriodicUnconditional(history)) return [D, memory]

  const { pC, pD, nAfterD } = responseRates(history)
  const total = memory.oppC + memory.oppD
  const defRate = total ? memory.oppD / total : 0
  const avg = memory.score / n

  if (
    memory.oppD >= 4 && defRate > 0.72 ||
    avg < 0.9 && n >= 20 ||
    memory.failedDTests >= 3
  ) {
    memory.hardLock = true
  }

  if (memory.hardLock) {
    if (memory.oppC > memory.oppD && defRate < 0.52) memory.hardLock = false
    else {
      if (
        memory.oppC > 0 &&
        memory.olives < OLIVE_SCHEDULE.length &&
        memory.mutualDStreak >= OLIVE_SCHEDULE[memory.olives]
      ) {
        memory.olives++
        return [C, memory]
      }
      return [D, memory]
    }
  }

  if (
    nAfterD >= MIN_AFTER_D &&
    pD >= EXPLOIT_THRESHOLD &&
    defRate < 0.35
  ) {
    return [D, memory]
  }

  if (pC >= COOP_THRESHOLD) {
    const unprovokedD = oppLast === D && !(prev && prev.you === D)
    if (unprovokedD) return [D, memory]

    if (
      oppLast === C &&
      !memory.probeDone &&
      n >= 8 &&
      defRate < 0.3
    ) {
      memory.probeDone = true
      memory.dTests++
      memory.grace = 1
      return [D, memory]
    }

    return [C, memory]
  }

  if (
    memory.oppC > 0 &&
    memory.olives < OLIVE_SCHEDULE.length &&
    memory.mutualDStreak >= OLIVE_SCHEDULE[memory.olives]
  ) {
    memory.olives++
    return [C, memory]
  }

  return [D, memory]
}

export default function bot(state) {
  let memory = null
  try {
    const history = state && Array.isArray(state.history) ? state.history : []
    memory = state && state.memory
    const [move, nextMemory] = decide(history, memory)
    return [move === D ? D : C, nextMemory]
  } catch {
    return [D, validMemory(memory) ? memory : baseMemory()]
  }
}