const STORAGE_KEY = 'ascension_tutorial';

interface TutorialData {
    hintsShown: string[];
    tutorialComplete: boolean;
    firstRunDone: boolean;
}

interface TutorialHint {
    id: string;
    title: string;
    text: string;
    trigger: 'immediate' | 'altitude' | 'event' | 'timer';
    triggerValue?: number | string;
    priority: number; // Lower = shown first if multiple trigger
}

const HINTS: TutorialHint[] = [
    {
        id: 'movement',
        title: 'Movement',
        text: 'Use Arrow Keys to move. Press SPACE to jump. Hold SPACE for higher jumps.',
        trigger: 'immediate',
        priority: 1,
    },
    {
        id: 'attack',
        title: 'Combat',
        text: 'Press Z, X, or C to attack. Combine with directions for different moves.',
        trigger: 'altitude',
        triggerValue: 50,
        priority: 2,
    },
    {
        id: 'dodge',
        title: 'Dodge',
        text: 'Press SHIFT to dodge. Time it perfectly to gain a damage buff!',
        trigger: 'altitude',
        triggerValue: 150,
        priority: 3,
    },
    {
        id: 'items',
        title: 'Items',
        text: 'Defeat enemies and bosses to find items. Silver items boost stats, Gold items grant abilities.',
        trigger: 'altitude',
        triggerValue: 300,
        priority: 4,
    },
    {
        id: 'boss_coming',
        title: 'Boss Approaching',
        text: 'A boss awaits every 1000m. Prepare yourself!',
        trigger: 'altitude',
        triggerValue: 700,
        priority: 5,
    },
    {
        id: 'essence',
        title: 'Demon Essence',
        text: 'Collect essence from defeated enemies. Spend it at shops and gambling shrines.',
        trigger: 'event',
        triggerValue: 'first-kill',
        priority: 3,
    },
    {
        id: 'shop',
        title: 'Shop',
        text: 'Golden platforms are shops. Step on them to browse items for essence.',
        trigger: 'event',
        triggerValue: 'near-shop',
        priority: 4,
    },
    {
        id: 'parry',
        title: 'Perfect Parry',
        text: 'Attack right as an enemy hits you to parry! Reflects damage and grants invincibility.',
        trigger: 'altitude',
        triggerValue: 500,
        priority: 5,
    },
    {
        id: 'class_ability',
        title: 'Class Ability',
        text: '', // Filled dynamically based on class
        trigger: 'timer',
        triggerValue: 10000, // 10 seconds into the run
        priority: 2,
    },
];

export const TutorialManager = {
    data: null as TutorialData | null,
    pendingHints: [] as TutorialHint[],
    currentHint: null as TutorialHint | null,
    onShowHint: null as ((hint: { title: string; text: string }) => void) | null,
    onHideHint: null as (() => void) | null,

    load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.data = JSON.parse(raw);
            }
        } catch { /* ignore */ }
        if (!this.data) {
            this.data = { hintsShown: [], tutorialComplete: false, firstRunDone: false };
        }
    },

    save(): void {
        if (this.data) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    },

    isFirstRun(): boolean {
        return !this.data?.firstRunDone;
    },

    shouldShowHint(hintId: string): boolean {
        if (this.data?.tutorialComplete) return false;
        return !this.data?.hintsShown.includes(hintId);
    },

    markHintShown(hintId: string): void {
        if (!this.data) return;
        if (!this.data.hintsShown.includes(hintId)) {
            this.data.hintsShown.push(hintId);
        }
        this.save();
    },

    completeFirstRun(): void {
        if (!this.data) return;
        this.data.firstRunDone = true;
        this.save();
    },

    completeTutorial(): void {
        if (!this.data) return;
        this.data.tutorialComplete = true;
        this.save();
    },

    showHint(hint: TutorialHint): void {
        if (!this.shouldShowHint(hint.id)) return;
        this.currentHint = hint;
        this.markHintShown(hint.id);
        this.onShowHint?.({ title: hint.title, text: hint.text });

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (this.currentHint?.id === hint.id) {
                this.hideHint();
            }
        }, 5000);
    },

    hideHint(): void {
        this.currentHint = null;
        this.onHideHint?.();
    },

    // Called each frame from MainScene with current state
    checkTriggers(altitude: number, elapsedMs: number, classType: string): void {
        if (this.data?.tutorialComplete || this.currentHint) return;

        for (const hint of HINTS) {
            if (!this.shouldShowHint(hint.id)) continue;

            switch (hint.trigger) {
                case 'immediate':
                    this.showHint(hint);
                    return;
                case 'altitude':
                    if (altitude >= (hint.triggerValue as number)) {
                        // Dynamic text for class ability hint
                        if (hint.id === 'class_ability') {
                            hint.text = this.getClassAbilityText(classType);
                        }
                        this.showHint(hint);
                        return;
                    }
                    break;
                case 'timer':
                    if (elapsedMs >= (hint.triggerValue as number)) {
                        if (hint.id === 'class_ability') {
                            hint.text = this.getClassAbilityText(classType);
                        }
                        this.showHint(hint);
                        return;
                    }
                    break;
            }
        }
    },

    // Triggered by specific game events
    triggerEvent(eventId: string): void {
        if (this.data?.tutorialComplete || this.currentHint) return;
        const hint = HINTS.find(h => h.trigger === 'event' && h.triggerValue === eventId);
        if (hint) this.showHint(hint);
    },

    getClassAbilityText(classType: string): string {
        switch (classType) {
            case 'PALADIN': return 'As a Paladin, stand still briefly to activate Shield Guard. It reduces frontal damage by 50%.';
            case 'MONK': return 'As a Monk, consecutive hits build your Flow meter. Higher flow means faster movement and more damage!';
            case 'PRIEST': return 'As a Priest, your C attack creates Sacred Ground that heals you and damages enemies.';
            default: return 'Your class has a unique ability. Experiment to discover it!';
        }
    },

    reset(): void {
        this.data = { hintsShown: [], tutorialComplete: false, firstRunDone: false };
        this.save();
    },
};
