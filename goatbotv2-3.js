// goatbot v2.3 - 1.614 average score
// deployed 9/4/26

const C = "C"
const D = "D"

const WINDOW = 12
const COOP_THRESHOLD = 0.6
const EXPLOIT_THRESHOLD = 0.41
const MIN_AFTER_D = 3
const OLIVE_SCHEDULE = [5, 18, 45]
const TEST_SCHEDULE = [10, 28]
const MAX_FAILED_TESTS = 1
const DD_ESCAPE = 4

function freshMemory() {
    return {
        seen: 0,
        oppC: 0,
        oppD: 0,
        mutualDStreak: 0,
        olives: 0,
        sparsePeace: false,
        score: 0,
        tests: [],
        failedTests: 0,
        probeCooldown: 0,
        hardLock: false,
        chaos: 0
    }
}

function rebuildMemory(history, previous) {
    const memory = freshMemory()

    if (previous && typeof previous === "object") {
        if (Number.isFinite(previous.olives)) memory.olives = Math.max(0, Math.floor(previous.olives))
        if (Array.isArray(previous.tests)) memory.tests = previous.tests.filter(Number.isFinite)
        if (Number.isFinite(previous.failedTests)) memory.failedTests = Math.max(0, Math.floor(previous.failedTests))
        if (typeof previous.sparsePeace === "boolean") memory.sparsePeace = previous.sparsePeace
        if (typeof previous.hardLock === "boolean") memory.hardLock = previous.hardLock
        if (Number.isFinite(previous.probeCooldown)) memory.probeCooldown = Math.max(0, Math.floor(previous.probeCooldown))
        if (Number.isFinite(previous.chaos)) memory.chaos = Math.max(0, Math.floor(previous.chaos))
    }

    for (let i = 0; i < history.length; i++) {
        const r = history[i]
        const y = r.you === D ? D : C
        const o = r.opponent === D ? D : C

        if (o === D) memory.oppD++
        else memory.oppC++

        if (y === D && o === D) memory.mutualDStreak++
        else memory.mutualDStreak = 0

        memory.score +=
            y === C && o === C ? 2 :
            y === D && o === C ? 3 :
            y === C && o === D ? 0 : 1

        if (i >= 2) {
            const p = history[i - 1].opponent === D ? 1 : 0
            const q = o === D ? 1 : 0
            if (p !== q) memory.chaos = Math.min(memory.chaos + 1, 100)
            else memory.chaos = Math.max(memory.chaos - 1, 0)
        }
    }

    for (let i = 0; i < memory.tests.length; i++) {
        const t = memory.tests[i]
        if (t + 1 < history.length && history[t + 1].opponent === D) memory.failedTests++
    }

    memory.seen = history.length
    return memory
}

function updateMemory(history, memory) {
    const n = history.length
    if (
        !memory || typeof memory !== "object" ||
        memory.seen !== n - 1 ||
        !Number.isFinite(memory.oppC) ||
        !Number.isFinite(memory.oppD) ||
        !Number.isFinite(memory.mutualDStreak) ||
        !Number.isFinite(memory.olives) ||
        !Number.isFinite(memory.score) ||
        !Array.isArray(memory.tests) ||
        !Number.isFinite(memory.failedTests) ||
        !Number.isFinite(memory.probeCooldown) ||
        !Number.isFinite(memory.chaos)
    ) return rebuildMemory(history, memory)

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

    if (n >= 2) {
        const p = history[n - 2].opponent === D ? 1 : 0
        const q = o === D ? 1 : 0
        if (p !== q) memory.chaos = Math.min(memory.chaos + 1, 100)
        else memory.chaos = Math.max(memory.chaos - 1, 0)
    }

    if (memory.probeCooldown > 0) memory.probeCooldown--

    memory.seen = n
    return memory
}

function responseRates(history) {
    let cAfterC = 0,
        nAfterC = 0
    let cAfterD = 0,
        nAfterD = 0
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
        pC: (cAfterC + 0.5) / (nAfterC + 1),
        pD: (cAfterD + 0.5) / (nAfterD + 1),
        nAfterD
    }
}

function isUnconditionalPeriodic(history) {
    const n = history.length
    if (n < 12) return false
    const start = Math.max(0, n - 20)

    let sawC = false,
        sawD = false
    for (let i = start; i < n; i++) {
        if (history[i].opponent === C) sawC = true
        else sawD = true
    }
    if (!sawC || !sawD) return false

    for (let period = 2; period <= 6; period++) {
        let matches = true,
            comps = 0
        for (let i = start + period; i < n; i++) {
            comps++
            if (history[i].opponent !== history[i - period].opponent) {
                matches = false
                break
            }
        }
        if (!matches || comps < 8) continue

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

function shouldSparsePeace(history) {
    const n = history.length
    if (n === 3) {
        return history[0].opponent === C && history[1].opponent === C && history[2].opponent === D && history.every(r => r.you === C)
    }
    if (n === 5) {
        return history[0].opponent === C && history[1].opponent === C && history[2].opponent === C && history[3].opponent === C && history[4].opponent === D && history.every(r => r.you === C)
    }
    return false
}

function decide(history, memory) {
    const n = history.length
    if (n === 0) return [C, freshMemory()]

    memory = updateMemory(history, memory)
    const last = history[n - 1]
    const prev = n >= 2 ? history[n - 2] : null
    const oppLast = last.opponent === D ? D : C

    if (history[0].opponent === D && history.every(r => r.you === C)) {
        if (n <= 4 || oppLast === C) return [C, memory]
    }

    if (!memory.sparsePeace && shouldSparsePeace(history)) {
        memory.sparsePeace = true
        return [C, memory]
    }

    if (memory.sparsePeace) {
        if (oppLast === D && prev && prev.opponent === D) memory.sparsePeace = false
        else return [C, memory]
    }

    if (memory.oppD === 0) return [C, memory]

    if (isUnconditionalPeriodic(history)) return [D, memory]

    const {
        pC,
        pD,
        nAfterD
    } = responseRates(history)
    const total = memory.oppC + memory.oppD
    const defRate = total ? memory.oppD / total : 0
    const avg = memory.score / n
    const noisy = n >= 18 && memory.chaos >= 10 && defRate > 0.2 && defRate < 0.8

    if (
        memory.hardLock ||
        (memory.oppD >= 4 && defRate > 0.72) ||
        (n >= 20 && avg < 0.92) ||
        (noisy && defRate > 0.45) ||
        (memory.failedTests > MAX_FAILED_TESTS)
    ) {
        memory.hardLock = true
        if (memory.oppC > memory.oppD && defRate < 0.52) memory.hardLock = false
        else {
            if (memory.oppC > 0 && memory.olives < OLIVE_SCHEDULE.length && memory.mutualDStreak >= OLIVE_SCHEDULE[memory.olives]) {
                memory.olives++
                return [C, memory]
            }
            return [D, memory]
        }
    }

    if (nAfterD >= MIN_AFTER_D && pD >= EXPLOIT_THRESHOLD && defRate < 0.42) {
        return [D, memory]
    }

    if (pC >= COOP_THRESHOLD) {
        const unprovokedD = oppLast === D && !(prev && prev.you === D)
        if (unprovokedD) return [D, memory]

        let coopStreak = 0
        for (let i = n - 1; i >= 0; i--) {
            if (history[i].you === C && history[i].opponent === C) coopStreak++
            else break
        }

        if (
            oppLast === C &&
            memory.tests.length < TEST_SCHEDULE.length &&
            memory.failedTests <= MAX_FAILED_TESTS &&
            coopStreak >= TEST_SCHEDULE[memory.tests.length] &&
            memory.probeCooldown === 0
        ) {
            memory.tests.push(n)
            memory.probeCooldown = 12
            return [D, memory]
        }

        if (memory.mutualDStreak >= DD_ESCAPE) return [C, memory]

        return [C, memory]
    }

    if (memory.oppC > 0 && memory.olives < OLIVE_SCHEDULE.length && memory.mutualDStreak >= OLIVE_SCHEDULE[memory.olives]) {
        memory.olives++
        return [C, memory]
    }

    return [D, memory]
}

export default function bot(state) {
    let memory = state && state.memory && typeof state.memory === "object" ? state.memory : null
    try {
        const history = state && Array.isArray(state.history) ? state.history : []
        const [move, nextMemory] = decide(history, memory)
        return [move === C ? C : D, nextMemory]
    } catch {
        return [D, memory || freshMemory()]
    }
}