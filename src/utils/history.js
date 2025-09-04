export class HistoryStack {
  constructor(limit = 20) {
    this.limit = limit
    this.stack = []
    this.index = -1
  }
  push(state) {
    // Drop future states if we push after undo
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1)
    }
    this.stack.push(state)
    if (this.stack.length > this.limit) {
      this.stack.shift()
    } else {
      this.index++
    }
  }
  canUndo(){ return this.index > 0 }
  canRedo(){ return this.index < this.stack.length - 1 }
  undo(){ if(this.canUndo()){ this.index--; return this.stack[this.index] } return null }
  redo(){ if(this.canRedo()){ this.index++; return this.stack[this.index] } return null }
  current(){ return this.stack[this.index] ?? null }
  reset(){ this.stack = []; this.index = -1 }
}
