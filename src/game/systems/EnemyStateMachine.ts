export interface StateDefinition<T> {
  onEnter?: (context: T) => void;
  onUpdate?: (context: T, time: number, delta: number) => void;
  onExit?: (context: T) => void;
}

export class EnemyStateMachine<T> {
  private states: Map<string, StateDefinition<T>> = new Map();
  private _currentState: string;
  private context: T;

  constructor(initialState: string, context: T) {
    this._currentState = initialState;
    this.context = context;
  }

  get currentState(): string {
    return this._currentState;
  }

  addState(name: string, definition: StateDefinition<T>): this {
    this.states.set(name, definition);
    return this;
  }

  /** Call once after all states are added to trigger onEnter for the initial state. */
  start(): void {
    const state = this.states.get(this._currentState);
    state?.onEnter?.(this.context);
  }

  transition(newState: string): void {
    if (newState === this._currentState) return;

    const oldDef = this.states.get(this._currentState);
    oldDef?.onExit?.(this.context);

    this._currentState = newState;

    const newDef = this.states.get(newState);
    newDef?.onEnter?.(this.context);
  }

  update(time: number, delta: number): void {
    const state = this.states.get(this._currentState);
    state?.onUpdate?.(this.context, time, delta);
  }
}
