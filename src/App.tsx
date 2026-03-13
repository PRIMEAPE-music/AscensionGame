import { useState, useEffect, useRef, useCallback } from "react";
import Phaser from "phaser";
import { MainScene } from "./game/scenes/MainScene";
import GameHUD from "./game/ui/GameHUD";
import { ClassSelect } from "./game/ui/ClassSelect";
import { PauseMenu } from "./game/ui/PauseMenu";
import { DeathScreen } from "./game/ui/DeathScreen";
import { ShopUI } from "./game/ui/ShopUI";
import { GamblingUI } from "./game/ui/GamblingUI";
import { ItemReplaceUI } from "./game/ui/ItemReplaceUI";
import { CLASSES } from "./game/config/ClassConfig";
import type { ClassType } from "./game/config/ClassConfig";
import type { ItemData } from "./game/config/ItemConfig";
import { ActiveModifiers } from "./game/config/RunModifiers";
import { EventBus } from "./game/systems/EventBus";
import type { ShopOffering } from "./game/systems/EventBus";
import { RunModifierSelect } from "./game/ui/RunModifierSelect";
import { AchievementManager } from "./game/systems/AchievementManager";
import { AchievementPopup } from "./game/ui/AchievementPopup";
import { PersistentStats } from "./game/systems/PersistentStats";
import { AscensionManager } from "./game/systems/AscensionManager";
import type { AscensionBoosts } from "./game/systems/AscensionManager";
import { AscensionScreen } from "./game/ui/AscensionScreen";
import { GoldItemCollection } from "./game/systems/GoldItemCollection";
import { GoldItemEquip } from "./game/ui/GoldItemEquip";
import { MainMenu } from "./game/ui/MainMenu";
import { StatsScreen } from "./game/ui/StatsScreen";
import { CollectionGallery } from "./game/ui/CollectionGallery";
import { SettingsScreen } from "./game/ui/SettingsScreen";
import { CosmeticScreen } from "./game/ui/CosmeticScreen";
import { DailyChallengeScreen } from "./game/ui/DailyChallengeScreen";
import { GameSettings } from "./game/systems/GameSettings";
import { ColorblindFilter } from "./game/systems/ColorblindFilter";
import type { ColorblindMode } from "./game/systems/ColorblindFilter";
import { CosmeticManager } from "./game/systems/CosmeticManager";
import { RunSaveManager } from "./game/systems/RunSaveManager";
import { AudioManager } from "./game/systems/AudioManager";
import { DailyChallenge } from "./game/systems/DailyChallenge";
import { LeaderboardManager } from "./game/systems/LeaderboardManager";
import { TutorialManager } from "./game/systems/TutorialManager";
import { TutorialOverlay } from "./game/ui/TutorialOverlay";
import { TouchControlsOverlay } from "./game/ui/TouchControlsOverlay";
import { LeaderboardScreen } from "./game/ui/LeaderboardScreen";
import { ReplayManager } from "./game/systems/ReplayManager";
import { ReplayScreen, PlaybackControls } from "./game/ui/ReplayScreen";
import { CoopManager } from "./game/systems/CoopManager";
import { SubclassSelect } from "./game/ui/SubclassSelect";
import { CoopItemDraft } from "./game/ui/CoopItemDraft";
import { UnlockManager } from "./game/systems/UnlockManager";
import { EndlessManager } from "./game/systems/EndlessManager";
import { WeeklyChallenge } from "./game/systems/WeeklyChallenge";
import { TrainingScene } from "./game/scenes/TrainingScene";
import { TrainingUI } from "./game/ui/TrainingUI";
import { BossRushScene } from "./game/scenes/BossRushScene";
import { BossRushUI } from "./game/ui/BossRushUI";
import { RunHistory } from "./game/systems/RunHistory";
import { ItemCodex } from "./game/systems/ItemCodex";
import { RunHistoryUI } from "./game/ui/RunHistoryUI";
import { ItemCodexUI } from "./game/ui/ItemCodexUI";
import { AscensionTree } from "./game/systems/AscensionTree";
import { ClassMastery } from "./game/systems/ClassMastery";
import { AscensionTreeUI } from "./game/ui/AscensionTreeUI";
import { ClassMasteryUI } from "./game/ui/ClassMasteryUI";
import { ExtrasScreen } from "./game/ui/ExtrasScreen";
import { OnlineLobby } from "./game/ui/OnlineLobby";
import { ConnectionStatus } from "./game/ui/ConnectionStatus";
import { OnlineCoopManager } from "./game/systems/OnlineCoopManager";
import { NetworkManager } from "./game/systems/NetworkManager";
import { GuestScene } from "./game/scenes/GuestScene";
import "./App.css";

type GameState = "MAIN_MENU" | "CLASS_SELECT" | "EQUIP" | "MODIFIERS" | "PLAYING" | "DEATH" | "TRAINING" | "BOSS_RUSH";

interface DeathStats {
  altitude: number;
  kills: number;
  bossesDefeated: number;
  timeMs: number;
  essenceEarned: number;
}

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const bossRushGameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>("MAIN_MENU");
  const [menuScreen, setMenuScreen] = useState<"main" | "stats" | "collection" | "settings" | "cosmetics" | "daily" | "leaderboard" | "replay" | "run_history" | "item_codex" | "ascension_tree" | "class_mastery" | "extras" | "online_lobby">("main");
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassType | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [health, setHealth] = useState(3);
  const [maxHealth, setMaxHealth] = useState(3);
  const [altitude, setAltitude] = useState(0);
  const [inventory, setInventory] = useState<ItemData[]>([]);
  const [styleMeter, setStyleMeter] = useState(0);
  const [styleTier, setStyleTier] = useState("D");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [essence, setEssence] = useState(0);
  const [deathStats, setDeathStats] = useState<DeathStats | null>(null);
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopOfferings, setShopOfferings] = useState<ShopOffering[]>([]);
  const [flowMeter, setFlowMeter] = useState(0);
  const [flowMaxFlow, setFlowMaxFlow] = useState(100);
  const [isShieldGuarding, setIsShieldGuarding] = useState(false);
  const [sacredGroundCooldown, setSacredGroundCooldown] = useState<{
    remaining: number;
    total: number;
  }>({ remaining: 0, total: 15000 });
  const [gamblingOpen, setGamblingOpen] = useState(false);
  const [gamblingEssence, setGamblingEssence] = useState(0);
  const [itemReplaceData, setItemReplaceData] = useState<{
    newItem: ItemData;
    currentItems: ItemData[];
  } | null>(null);
  const [coopDraftItems, setCoopDraftItems] = useState<ItemData[] | null>(null);
  const [ascensionOpen, setAscensionOpen] = useState(false);
  const [ascensionBossNumber, setAscensionBossNumber] = useState(0);
  const [achievementPopup, setAchievementPopup] = useState<{
    name: string;
    description: string;
    icon: string;
  } | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<
    { name: string; description: string; icon: string }[]
  >([]);
  const [hasSavedRun, setHasSavedRun] = useState(false);
  const [savedRunInfo, setSavedRunInfo] = useState<{ classType: string; altitude: number; timestamp: number } | null>(null);
  const [isCoopMode, setIsCoopMode] = useState(false);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [onlineLatency, setOnlineLatency] = useState(0);
  const [onlineConnectionState, setOnlineConnectionState] = useState("idle");
  const [onlineRoomCode, setOnlineRoomCode] = useState("");
  const [coopSelectingPlayer, setCoopSelectingPlayer] = useState<1 | 2>(1);
  const [selectedClass2, setSelectedClass2] = useState<ClassType | null>(null);
  const [health2, setHealth2] = useState(3);
  const [maxHealth2, setMaxHealth2] = useState(3);
  const [tutorialHint, setTutorialHint] = useState<{ title: string; text: string } | null>(null);
  const [subclassSelectOpen, setSubclassSelectOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const maxComboRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const inventoryRef = useRef<ItemData[]>([]);

  // Load persistent data on mount
  useEffect(() => {
    PersistentStats.load();
    AscensionManager.load();
    GoldItemCollection.load();
    AchievementManager.load();
    GameSettings.load();
    CosmeticManager.load();
    DailyChallenge.load();
    LeaderboardManager.load();
    TutorialManager.load();
    TutorialManager.onShowHint = (hint) => setTutorialHint(hint);
    TutorialManager.onHideHint = () => setTutorialHint(null);
    ReplayManager.load();
    UnlockManager.load();
    RunHistory.load();
    ItemCodex.load();
    AscensionTree.load();
    ClassMastery.load();

    // Check for saved run
    setHasSavedRun(RunSaveManager.hasSave());
    setSavedRunInfo(RunSaveManager.getSaveInfo());
  }, []);

  // Colorblind filter: listen for settings changes and apply/remove filter on the game canvas
  useEffect(() => {
    const handleColorblindChange = () => {
      const canvas = document.querySelector('#phaser-game canvas') as HTMLElement | null;
      if (canvas) {
        const mode = GameSettings.get().colorblindMode as ColorblindMode;
        if (mode && mode !== 'NONE') {
          ColorblindFilter.applyFilter(canvas, mode);
        } else {
          ColorblindFilter.removeFilter(canvas);
        }
      }
    };
    window.addEventListener('colorblind-mode-change', handleColorblindChange);
    return () => window.removeEventListener('colorblind-mode-change', handleColorblindChange);
  }, []);

  // High contrast filter: apply CSS contrast boost to the game canvas
  useEffect(() => {
    const applyHighContrast = () => {
      const canvas = document.querySelector('#phaser-game canvas') as HTMLElement | null;
      if (canvas) {
        if (GameSettings.get().highContrast) {
          canvas.style.filter = [canvas.style.filter.replace(/contrast\([^)]*\)\s*/g, '').trim(), 'contrast(1.3)'].filter(Boolean).join(' ');
        } else {
          canvas.style.filter = canvas.style.filter.replace(/contrast\([^)]*\)\s*/g, '').trim();
        }
      }
    };
    // Apply on mount after canvas is ready
    const timer = setTimeout(applyHighContrast, 150);
    window.addEventListener('high-contrast-change', applyHighContrast);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('high-contrast-change', applyHighContrast);
    };
  }, []);

  // FPS counter
  useEffect(() => {
    if (!GameSettings.get().showFPS) return;
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;
    const measure = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(measure);
    };
    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Process achievement popup queue — show next when current is dismissed
  useEffect(() => {
    if (achievementPopup === null && achievementQueue.length > 0) {
      const [next, ...rest] = achievementQueue;
      setAchievementPopup(next);
      setAchievementQueue(rest);
    }
  }, [achievementPopup, achievementQueue]);

  // Listen for feature-unlocked events and queue a notification popup
  useEffect(() => {
    const unsub = EventBus.on("feature-unlocked", (data) => {
      setAchievementQueue((prev) => [
        ...prev,
        {
          name: `NEW UNLOCK: ${data.featureName}`,
          description: "Check the main menu for the new content!",
          icon: "\u{1F513}", // unlocked lock
        },
      ]);
    });
    return unsub;
  }, []);

  // Menu music: play Warmth on main menu, stop when leaving
  useEffect(() => {
    if (gameState === "MAIN_MENU") {
      AudioManager.startMenuMusic();
    } else {
      AudioManager.stopMenuMusic();
    }
  }, [gameState]);

  const handleStartRun = useCallback(() => {
    setGameState("CLASS_SELECT");
  }, []);

  const handleCoopStart = useCallback(() => {
    setIsCoopMode(true);
    setCoopSelectingPlayer(1);
    setGameState("CLASS_SELECT");
  }, []);

  const handleResumeRun = useCallback(() => {
    const saveData = RunSaveManager.load();
    if (!saveData) {
      // Save corrupted or missing, fall back to normal start
      setHasSavedRun(false);
      setSavedRunInfo(null);
      return;
    }

    // Set the class
    (window as any).__selectedClass = saveData.classType;
    setSelectedClass(saveData.classType as ClassType);

    // Set gold items
    (window as any).__equippedGoldItems = saveData.equippedGoldItems;

    // Restore active modifiers
    ActiveModifiers.setModifiers(saveData.activeModifiers);

    // Store save data for MainScene to read
    (window as any).__resumeData = saveData;

    // Clear the saved run state in UI
    setHasSavedRun(false);
    setSavedRunInfo(null);

    // Skip class select/equip/modifiers — go directly to PLAYING
    ReplayManager.startRecording(saveData.classType);
    setGameState("PLAYING");
    startTimeRef.current = Date.now() - saveData.elapsedTimeMs;
    elapsedTimeRef.current = saveData.elapsedTimeMs;
  }, []);

  const handleShowStats = useCallback(() => {
    setMenuScreen("stats");
  }, []);

  const handleShowCollection = useCallback(() => {
    setMenuScreen("collection");
  }, []);

  const handleShowSettings = useCallback(() => {
    setMenuScreen("settings");
  }, []);

  const handleShowCosmetics = useCallback(() => {
    setMenuScreen("cosmetics");
  }, []);

  const handleDailyChallenge = useCallback(() => {
    setMenuScreen("daily");
  }, []);

  const handleShowLeaderboard = useCallback(() => {
    setMenuScreen("leaderboard");
  }, []);

  const handleShowReplay = useCallback(() => {
    setMenuScreen("replay");
  }, []);

  // Training Room handler
  const handleTrainingRoom = useCallback(() => {
    // Use the currently selected class, or default to MONK
    (window as any).__trainingClass = selectedClass || "MONK";
    setGameState("TRAINING");
  }, [selectedClass]);

  const handleBossRush = useCallback(() => {
    setGameState("CLASS_SELECT");
    (window as any).__bossRushPending = true;
  }, []);

  const handleEndlessMode = useCallback(() => {
    // Endless mode: player selects class, then starts run with endless scaling active
    EndlessManager.activate();
    (window as any).__isEndlessMode = true;
    setGameState("CLASS_SELECT");
  }, []);

  const handleWeeklyChallenge = useCallback(() => {
    // Weekly challenge: pre-configured class + modifiers, 3x essence
    const challenge = WeeklyChallenge.getCurrentChallenge();
    setSelectedClass(challenge.class as ClassType);
    (window as any).__selectedClass = challenge.class;
    (window as any).__isWeeklyChallenge = true;
    (window as any).__weeklyEssenceMultiplier = 3;
    ActiveModifiers.setModifiers(challenge.modifiers);
    ReplayManager.startRecording(challenge.class);
    // Track weekly challenge run in DailyChallenge system
    DailyChallenge.load();
    setGameState("PLAYING");
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
  }, []);

  const handleWatchReplay = useCallback((replayIndex: number) => {
    const replay = ReplayManager.loadReplay(replayIndex);
    if (replay) {
      ReplayManager.startPlayback(replay);
      setReplayPlaying(true);
    }
  }, []);

  const handleStopPlayback = useCallback(() => {
    ReplayManager.stopPlayback();
    setReplayPlaying(false);
  }, []);

  const handleStartDailyChallenge = useCallback((challengeData: { class: string; modifiers: string[]; seed: number }) => {
    setSelectedClass(challengeData.class as ClassType);
    (window as any).__selectedClass = challengeData.class;
    (window as any).__dailyChallengeSeed = challengeData.seed;
    (window as any).__isDailyChallenge = true;
    ActiveModifiers.setModifiers(challengeData.modifiers);
    ReplayManager.startRecording(challengeData.class);
    setGameState("PLAYING");
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
  }, []);

  const handleStartWeeklyChallenge = useCallback((challengeData: { class: string; modifiers: string[]; seed: number; specialRule: string }) => {
    setSelectedClass(challengeData.class as ClassType);
    (window as any).__selectedClass = challengeData.class;
    (window as any).__dailyChallengeSeed = challengeData.seed;
    (window as any).__isWeeklyChallenge = true;
    (window as any).__weeklySpecialRule = challengeData.specialRule;
    ActiveModifiers.setModifiers(challengeData.modifiers);
    ReplayManager.startRecording(challengeData.class);
    setGameState("PLAYING");
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
  }, []);

  const handleShowRunHistory = useCallback(() => {
    setMenuScreen("run_history");
  }, []);

  const handleShowItemCodex = useCallback(() => {
    setMenuScreen("item_codex");
  }, []);

  const handleShowAscensionTree = useCallback(() => {
    setMenuScreen("ascension_tree");
  }, []);

  const handleShowClassMastery = useCallback(() => {
    setMenuScreen("class_mastery");
  }, []);

  const handleShowExtras = useCallback(() => {
    setMenuScreen("extras");
  }, []);

  const handleOnlineCoopStart = useCallback(() => {
    setMenuScreen("online_lobby");
  }, []);

  const handleOnlineGameStart = useCallback((role: 'host' | 'guest', roomCode: string, hostClass: string, guestClass: string) => {
    setIsOnlineMode(true);
    setOnlineRoomCode(roomCode);

    if (role === 'host') {
      // Host: set up classes and start the game like local co-op
      setSelectedClass(hostClass as ClassType);
      (window as any).__selectedClass = hostClass;
      setSelectedClass2(guestClass as ClassType);
      setIsCoopMode(true);
      // CoopManager.activateOnline is called by OnlineCoopManager.startGame
      setGameState("EQUIP");
    } else {
      // Guest: will render GuestScene instead of MainScene
      setSelectedClass(guestClass as ClassType);
      (window as any).__selectedClass = guestClass;
      (window as any).__isOnlineGuest = true;
      setIsCoopMode(true);
      setGameState("PLAYING");
      startTimeRef.current = Date.now();
      elapsedTimeRef.current = 0;
    }
    setMenuScreen("main");
  }, []);

  // Update online connection state for the status indicator
  useEffect(() => {
    if (!isOnlineMode) return;
    const interval = setInterval(() => {
      setOnlineLatency(NetworkManager.getLatency());
      setOnlineConnectionState(NetworkManager.getState());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnlineMode]);

  const handleBackToMenu = useCallback(() => {
    setMenuScreen("main");
  }, []);

  const handleClassSelect = useCallback((classType: ClassType) => {
    if (isCoopMode && coopSelectingPlayer === 1) {
      // P1 selected, now P2 selects
      setSelectedClass(classType);
      (window as any).__selectedClass = classType;
      setCoopSelectingPlayer(2);
      // Stay in CLASS_SELECT for P2
    } else if (isCoopMode && coopSelectingPlayer === 2) {
      // P2 selected — activate co-op and proceed
      setSelectedClass2(classType);
      CoopManager.activate(classType);
      setGameState("EQUIP");
    } else {
      // Solo mode — existing behavior
      setSelectedClass(classType);
      (window as any).__selectedClass = classType;
      setGameState("EQUIP");
    }
  }, [isCoopMode, coopSelectingPlayer]);

  const handleGoldEquipConfirm = useCallback((equippedIds: string[]) => {
    (window as any).__equippedGoldItems = equippedIds;
    if ((window as any).__bossRushPending) {
      delete (window as any).__bossRushPending;
      setGameState("BOSS_RUSH");
    } else {
      setGameState("MODIFIERS");
    }
  }, []);

  const handleModifiersConfirm = useCallback((modifierIds: string[]) => {
    // Starting a new run — clear any existing saved run
    RunSaveManager.clear();
    setHasSavedRun(false);
    setSavedRunInfo(null);
    ActiveModifiers.setModifiers(modifierIds);
    ReplayManager.startRecording((window as any).__selectedClass || "MONK");
    setGameState("PLAYING");
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
  }, []);

  const togglePause = useCallback(() => {
    if (gameState !== "PLAYING") return;

    setIsPaused((prev) => {
      const next = !prev;
      const scene = gameRef.current?.scene.getScene("MainScene");
      if (scene) {
        if (next) {
          pausedAtRef.current = Date.now();
          elapsedTimeRef.current = pausedAtRef.current - startTimeRef.current;
          scene.scene.pause();
        } else {
          // Adjust start time to account for pause duration
          const pauseDuration = Date.now() - pausedAtRef.current;
          startTimeRef.current += pauseDuration;
          scene.scene.resume();
        }
      }
      return next;
    });
  }, [gameState]);

  const handleResume = useCallback(() => {
    togglePause();
  }, [togglePause]);

  const handleRestart = useCallback(() => {
    // Clear saved run since we're restarting
    RunSaveManager.clear();
    AudioManager.stopMusic();
    setIsPaused(false);
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setEssence(0);
    setComboCount(0);
    setComboMultiplier(1.0);
    setDeathStats(null);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    setItemReplaceData(null);
    setSubclassSelectOpen(false);
    ActiveModifiers.clear();
    GoldItemCollection.clearEquipped();
    delete (window as any).__isDailyChallenge;
    delete (window as any).__dailyChallengeSeed;
    delete (window as any).__isWeeklyChallenge;
    delete (window as any).__weeklySpecialRule;
    delete (window as any).__isEndlessMode;
    delete (window as any).__endlessModeNewBest;
    delete (window as any).__weeklyEssenceMultiplier;
    delete (window as any).__bossRushPending;
    EndlessManager.deactivate();
    gameRef.current?.destroy(true);
    gameRef.current = null;
    if (bossRushGameRef.current) {
      bossRushGameRef.current.destroy(true);
      bossRushGameRef.current = null;
    }
    setHasSavedRun(false);
    setSavedRunInfo(null);
    setIsCoopMode(false);
    setCoopSelectingPlayer(1);
    setSelectedClass2(null);
    setHealth2(3);
    setMaxHealth2(3);
    CoopManager.deactivate();
    if (isOnlineMode) {
      OnlineCoopManager.disconnect();
      setIsOnlineMode(false);
      setOnlineRoomCode("");
    }
    delete (window as any).__isOnlineGuest;
    setGameState("MAIN_MENU");
    setMenuScreen("main");
    setSelectedClass(null);
  }, [isOnlineMode]);

  const handleQuit = useCallback(() => {
    AudioManager.stopMusic();
    // Save run state before quitting to menu (only if actively playing, not dead)
    if (gameState === "PLAYING") {
      const scene = gameRef.current?.scene.getScene("MainScene") as any;
      if (scene && typeof scene.buildSaveData === 'function') {
        RunSaveManager.save(scene.buildSaveData());
      }
    }

    setIsPaused(false);
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setEssence(0);
    setComboCount(0);
    setComboMultiplier(1.0);
    setDeathStats(null);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    setItemReplaceData(null);
    setSubclassSelectOpen(false);
    ActiveModifiers.clear();
    GoldItemCollection.clearEquipped();
    // Update saved run state for the menu
    setHasSavedRun(RunSaveManager.hasSave());
    setSavedRunInfo(RunSaveManager.getSaveInfo());
    delete (window as any).__isDailyChallenge;
    delete (window as any).__dailyChallengeSeed;
    delete (window as any).__isWeeklyChallenge;
    delete (window as any).__weeklySpecialRule;
    delete (window as any).__isEndlessMode;
    delete (window as any).__endlessModeNewBest;
    delete (window as any).__weeklyEssenceMultiplier;
    delete (window as any).__bossRushPending;
    EndlessManager.deactivate();
    if (bossRushGameRef.current) {
      bossRushGameRef.current.destroy(true);
      bossRushGameRef.current = null;
    }
    setIsCoopMode(false);
    setCoopSelectingPlayer(1);
    setSelectedClass2(null);
    setHealth2(3);
    setMaxHealth2(3);
    CoopManager.deactivate();
    if (isOnlineMode) {
      OnlineCoopManager.disconnect();
      setIsOnlineMode(false);
      setOnlineRoomCode("");
    }
    delete (window as any).__isOnlineGuest;
    setGameState("MAIN_MENU");
    setMenuScreen("main");
    setSelectedClass(null);
  }, [gameState, isOnlineMode]);

  // Retry from death screen - restart with the same class
  const handleDeathRetry = useCallback(() => {
    // Run save already cleared on death in MainScene
    AudioManager.stopMusic();
    RunSaveManager.clear();
    setDeathStats(null);
    setEssence(0);
    setHealth(3);
    setMaxHealth(3);
    setAltitude(0);
    setInventory([]);
    setStyleMeter(0);
    setStyleTier("D");
    setComboCount(0);
    setComboMultiplier(1.0);
    setShopOpen(false);
    setShopOfferings([]);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    setGamblingOpen(false);
    setGamblingEssence(0);
    setItemReplaceData(null);
    setSubclassSelectOpen(false);
    ActiveModifiers.clear();
    GoldItemCollection.clearEquipped();
    delete (window as any).__isDailyChallenge;
    delete (window as any).__dailyChallengeSeed;
    delete (window as any).__isWeeklyChallenge;
    delete (window as any).__weeklySpecialRule;
    delete (window as any).__isEndlessMode;
    delete (window as any).__endlessModeNewBest;
    delete (window as any).__weeklyEssenceMultiplier;
    EndlessManager.deactivate();
    setIsCoopMode(false);
    setCoopSelectingPlayer(1);
    setSelectedClass2(null);
    setHealth2(3);
    setMaxHealth2(3);
    CoopManager.deactivate();
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setGameState("PLAYING"); // Triggers game recreation with same class
  }, []);

  // Ascension chosen handler
  const handleAscensionChosen = useCallback((stat: keyof AscensionBoosts) => {
    AscensionManager.addBoost(stat);
    setAscensionOpen(false);
    EventBus.emit("ascension-chosen", { stat });
  }, []);

  // Subclass chosen handler
  const handleSubclassSelect = useCallback((subclassId: string) => {
    setSubclassSelectOpen(false);
    EventBus.emit("subclass-chosen", { subclassId });
  }, []);

  // Shop purchase handler
  const handleShopPurchase = useCallback(
    (offering: ShopOffering) => {
      if (essence < offering.cost) return;
      setEssence((prev) => prev - offering.cost);
      EventBus.emit("shop-purchase", {
        offeringId: offering.id,
        cost: offering.cost,
      });
    },
    [essence],
  );

  // Shop close handler
  const handleShopClose = useCallback(() => {
    setShopOpen(false);
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene) scene.scene.resume();
  }, []);

  // Gambling close handler
  const handleGamblingClose = useCallback(() => {
    setGamblingOpen(false);
  }, []);

  // Item replace handlers
  const handleItemReplaceTake = useCallback((replaceIndex: number) => {
    if (!itemReplaceData) return;
    EventBus.emit("item-replace-decision", { action: "take", replaceIndex });
    setItemReplaceData(null);
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene) scene.scene.resume();
  }, [itemReplaceData]);

  const handleItemReplaceLeave = useCallback(() => {
    EventBus.emit("item-replace-decision", { action: "leave" });
    setItemReplaceData(null);
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene) scene.scene.resume();
  }, []);

  // Co-op item draft handler
  const handleCoopDraftComplete = useCallback((p1ItemId: string, p2ItemId: string) => {
    setCoopDraftItems(null);
    EventBus.emit("coop-draft-complete", { p1Item: p1ItemId, p2Item: p2ItemId });
    const scene = gameRef.current?.scene.getScene("MainScene");
    if (scene) scene.scene.resume();
  }, []);

  // Escape key handler
  useEffect(() => {
    if (gameState !== "PLAYING") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPaused((prev) => {
          const next = !prev;
          const scene = gameRef.current?.scene.getScene("MainScene");
          if (scene) {
            if (next) {
              pausedAtRef.current = Date.now();
              elapsedTimeRef.current = pausedAtRef.current - startTimeRef.current;
              scene.scene.pause();
            } else {
              const pauseDuration = Date.now() - pausedAtRef.current;
              startTimeRef.current += pauseDuration;
              scene.scene.resume();
            }
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  // Elapsed time tracking
  useEffect(() => {
    if (gameState !== "PLAYING" || isPaused) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, isPaused]);

  // Player died event handler — now handled via show-death-screen
  // Keep listening to reset HUD state when scene restarts in background
  useEffect(() => {
    const unsubscribe = EventBus.on("player-died", () => {
      // Scene restarts automatically in Player.ts, but we show the death screen overlay
      // Don't reset state here — the death screen or retry handler will do that
    });
    return unsubscribe;
  }, []);

  // Counter incremented each time we need to create a new Phaser game
  const [gameSessionId, setGameSessionId] = useState(0);

  // Trigger new game session when entering PLAYING without an active game
  useEffect(() => {
    if (gameState === "PLAYING" && !gameRef.current) {
      setGameSessionId((prev) => prev + 1);
    }
  }, [gameState]);

  // Phaser game creation — keyed on gameSessionId so it persists through DEATH
  useEffect(() => {
    if (gameSessionId === 0) return;
    if (gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: "phaser-game",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 1000 },
          debug: false,
        },
      },
      scene: (window as any).__isOnlineGuest ? [GuestScene] : [MainScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);

    // Set up achievement event listeners for real-time tracking during gameplay
    if (!(window as any).__isOnlineGuest) {
      AchievementManager.setupEventListeners();
    }

    // Online host: start the OnlineCoopManager once the scene is ready
    let onlineStartTimer: ReturnType<typeof setTimeout> | null = null;
    if (isOnlineMode && NetworkManager.isHost()) {
      onlineStartTimer = setTimeout(() => {
        const scene = gameRef.current?.scene.getScene("MainScene");
        if (scene) {
          OnlineCoopManager.startGame(
            scene,
            (window as any).__selectedClass || "PALADIN",
            selectedClass2 || "MONK"
          );
        }
      }, 500); // Short delay to ensure scene is initialized
    }

    // Apply colorblind filter to the game canvas once it renders
    const applyColorblindFilter = () => {
      const canvas = document.querySelector('#phaser-game canvas') as HTMLElement | null;
      if (canvas) {
        const mode = GameSettings.get().colorblindMode as ColorblindMode;
        if (mode && mode !== 'NONE') {
          ColorblindFilter.applyFilter(canvas, mode);
        } else {
          ColorblindFilter.removeFilter(canvas);
        }
      }
    };
    // Small delay to ensure the canvas exists in DOM
    const filterTimer = setTimeout(applyColorblindFilter, 100);

    // Event Listeners
    const handleHealthChange = (e: CustomEvent) => {
      const idx = e.detail.playerIndex ?? 0;
      if (idx === 0) {
        setHealth(e.detail.health);
        if (e.detail.maxHealth) setMaxHealth(e.detail.maxHealth);
      } else {
        setHealth2(e.detail.health);
        if (e.detail.maxHealth) setMaxHealth2(e.detail.maxHealth);
      }
    };

    const handleAltitudeChange = (e: CustomEvent) => {
      setAltitude(e.detail.altitude);
    };

    const handleInventoryChange = (e: CustomEvent) => {
      const newInventory = e.detail.inventory || [];
      setInventory(newInventory);
      inventoryRef.current = newInventory;
      // Discover all items in current inventory for the Item Codex
      try {
        const ids = newInventory.map((item: ItemData) => item.id);
        if (ids.length > 0) {
          ItemCodex.discoverMany(ids);
        }
      } catch {
        // Silently ignore
      }
    };

    const handleStyleChange = (e: CustomEvent) => {
      setStyleMeter(e.detail.meter);
      setStyleTier(e.detail.tier);
    };

    window.addEventListener(
      "health-change",
      handleHealthChange as EventListener,
    );
    window.addEventListener(
      "altitude-change",
      handleAltitudeChange as EventListener,
    );
    window.addEventListener(
      "inventory-change",
      handleInventoryChange as EventListener,
    );
    window.addEventListener("style-change", handleStyleChange as EventListener);

    const handleComboUpdate = (e: CustomEvent) => {
      setComboCount(e.detail.count);
      setComboMultiplier(e.detail.multiplier);
      // Track max combo this run for achievements
      if (e.detail.count > maxComboRef.current) {
        maxComboRef.current = e.detail.count;
      }
    };

    const handleEssenceChange = (e: CustomEvent) => {
      setEssence(e.detail.essence);
    };

    const handleDeathScreen = (e: CustomEvent) => {
      const stats = e.detail;
      // Stop replay recording and auto-save as "last run"
      ReplayManager.stopRecording({
        altitude: stats.altitude,
        kills: stats.kills,
        bossesDefeated: stats.bossesDefeated,
        timeMs: stats.timeMs,
      });
      // Expose max combo for leaderboard submission in DeathScreen
      (window as any).__maxComboThisRun = maxComboRef.current;
      setDeathStats(stats);
      setGameState("DEATH");

      // --- Run History & Item Codex ---
      try {
        const currentInventory = inventoryRef.current || [];
        const itemIds = currentInventory.map((item: ItemData) => item.id);

        // Determine game mode
        let gameMode = "standard";
        if ((window as any).__isDailyChallenge) gameMode = "daily";
        else if ((window as any).__isWeeklyChallenge) gameMode = "weekly";
        else if (EndlessManager.isActive()) gameMode = "endless";

        // Record run in history
        const runRecord = {
          id: RunHistory.generateId(),
          date: new Date().toISOString(),
          classType: (window as any).__selectedClass || "UNKNOWN",
          subclass: null as string | null,
          altitude: stats.altitude,
          timeMs: stats.timeMs,
          kills: stats.kills,
          bossesDefeated: stats.bossesDefeated,
          itemsCollected: itemIds,
          causeOfDeath: stats.altitude >= 5000 ? "victory" : "unknown",
          essenceEarned: stats.essenceEarned,
          maxCombo: maxComboRef.current,
          gameMode,
        };
        RunHistory.addRun(runRecord);

        // Discover all items the player collected this run
        if (itemIds.length > 0) {
          ItemCodex.discoverMany(itemIds);
        }
      } catch {
        // Silently ignore errors in run history / codex recording
      }
      // Add earned essence to Ascension Tree meta-essence pool
      try {
        const essenceForTree = Math.floor(stats.essenceEarned * AscensionTree.getBonusEssenceGain());
        if (essenceForTree > 0) {
          AscensionTree.addEssence(essenceForTree);
        }
      } catch { /* silently ignore */ }

      // Award Class Mastery XP
      try {
        const runClass = (window as any).__selectedClass || "";
        if (runClass) {
          const masteryXP = ClassMastery.calculateRunXP({
            altitude: stats.altitude,
            kills: stats.kills,
            bossesDefeated: stats.bossesDefeated,
            perfectParries: PersistentStats.getRunStats().perfectParries,
            maxCombo: maxComboRef.current,
          });
          if (masteryXP > 0) {
            ClassMastery.addXP(runClass, masteryXP);
          }
        }
      } catch { /* silently ignore */ }

      // Reset inventory ref for next run
      inventoryRef.current = [];

      // Submit daily challenge run if applicable
      if ((window as any).__isDailyChallenge) {
        const isNewBest = DailyChallenge.submitRun(
          stats.altitude,
          stats.kills,
          stats.bossesDefeated,
          stats.timeMs
        );
        (window as any).__dailyChallengeNewBest = isNewBest;
      }

      // Submit weekly challenge run if applicable
      if ((window as any).__isWeeklyChallenge) {
        const isNewBest = DailyChallenge.submitWeeklyRun(
          stats.altitude,
          stats.kills,
          stats.bossesDefeated,
          stats.timeMs
        );
        (window as any).__weeklyChallengeNewBest = isNewBest;
      }

      // Submit endless mode run if applicable
      if (EndlessManager.isActive()) {
        const classType = (window as any).__selectedClass || "UNKNOWN";
        const isNewBest = EndlessManager.submitRun(
          stats.altitude,
          stats.kills,
          stats.bossesDefeated,
          stats.timeMs,
          classType
        );
        (window as any).__endlessModeNewBest = isNewBest;
      }

      // Check achievements after run ends
      try {
        const lifetimeStats = PersistentStats.getLifetimeStats();
        const goldItemCount = PersistentStats.getUnlockedGoldItems().length;
        const newlyUnlocked = AchievementManager.checkAchievements({
          lifetime: {
            totalBossesDefeated: lifetimeStats.totalBossesDefeated,
            totalDeaths: lifetimeStats.totalDeaths,
            highestAltitude: lifetimeStats.highestAltitude,
            totalRuns: lifetimeStats.totalRuns,
          },
          run: {
            altitude: stats.altitude,
            kills: stats.kills,
            bossesDefeated: stats.bossesDefeated,
            essenceEarned: stats.essenceEarned,
          },
          currentClass: (window as any).__selectedClass || "",
          goldItemCount,
          maxComboThisRun: maxComboRef.current,
          totalKills: AchievementManager.getTotalKills(),
        });

        if (newlyUnlocked.length > 0) {
          const popups = newlyUnlocked
            .map((id) => AchievementManager.getById(id))
            .filter(Boolean)
            .map((a) => ({ name: a!.name, description: a!.description, icon: a!.icon }));
          setAchievementQueue((prev) => [...prev, ...popups]);
        }
      } catch {
        // PersistentStats may not be ready; skip achievement check
      }

      // Reset max combo for next run
      maxComboRef.current = 0;
      delete (window as any).__maxComboThisRun;
    };

    const handleShopOpen = (e: CustomEvent) => {
      setShopOfferings(e.detail.offerings);
      setShopOpen(true);
    };

    const handleGamblingOpen = (e: CustomEvent) => {
      setGamblingEssence(e.detail.essence);
      setGamblingOpen(true);
    };

    window.addEventListener(
      "combo-update",
      handleComboUpdate as EventListener,
    );
    window.addEventListener(
      "essence-change",
      handleEssenceChange as EventListener,
    );
    window.addEventListener(
      "show-death-screen",
      handleDeathScreen as EventListener,
    );
    window.addEventListener(
      "shop-open",
      handleShopOpen as EventListener,
    );
    window.addEventListener(
      "gambling-open",
      handleGamblingOpen as EventListener,
    );

    const handleItemReplacePrompt = (e: CustomEvent) => {
      setItemReplaceData(e.detail);
    };
    window.addEventListener(
      "item-replace-prompt",
      handleItemReplacePrompt as EventListener,
    );

    const handleCoopItemDraft = (e: CustomEvent) => {
      setCoopDraftItems(e.detail.items);
    };
    window.addEventListener(
      "coop-item-draft",
      handleCoopItemDraft as EventListener,
    );

    const handleAscensionOffer = (e: CustomEvent) => {
      setAscensionBossNumber(e.detail.bossNumber);
      setAscensionOpen(true);
    };
    window.addEventListener(
      "ascension-offer",
      handleAscensionOffer as EventListener,
    );

    const handleAscensionChosen = () => {
      setAscensionOpen(false);
    };
    window.addEventListener(
      "ascension-chosen",
      handleAscensionChosen as EventListener,
    );

    // Subclass offer event: pause game and show subclass selection UI
    const handleSubclassOffer = () => {
      setSubclassSelectOpen(true);
      const sc = gameRef.current?.scene.getScene("MainScene");
      if (sc) sc.scene.pause();
    };
    window.addEventListener(
      "subclass-offer",
      handleSubclassOffer as EventListener,
    );

    // Subclass chosen event: close UI and resume game
    const handleSubclassChosen = () => {
      setSubclassSelectOpen(false);
      const sc = gameRef.current?.scene.getScene("MainScene");
      if (sc) sc.scene.resume();
    };
    window.addEventListener(
      "subclass-chosen",
      handleSubclassChosen as EventListener,
    );

    // Class mechanic event listeners
    const handleFlowChange = (e: CustomEvent) => {
      setFlowMeter(e.detail.flow);
      setFlowMaxFlow(e.detail.maxFlow);
    };

    const handleShieldGuardChange = (e: CustomEvent) => {
      setIsShieldGuarding(e.detail.active);
    };

    const handleSacredGroundCooldown = (e: CustomEvent) => {
      setSacredGroundCooldown({
        remaining: e.detail.remaining,
        total: e.detail.total,
      });
    };

    window.addEventListener(
      "flow-change",
      handleFlowChange as EventListener,
    );
    window.addEventListener(
      "shield-guard-change",
      handleShieldGuardChange as EventListener,
    );
    window.addEventListener(
      "sacred-ground-cooldown",
      handleSacredGroundCooldown as EventListener,
    );

    return () => {
      clearTimeout(filterTimer);
      if (onlineStartTimer) clearTimeout(onlineStartTimer);
      // Clean up achievement event listeners
      AchievementManager.cleanupEventListeners();
      // Remove colorblind filter from canvas
      const canvas = document.querySelector('#phaser-game canvas') as HTMLElement | null;
      if (canvas) ColorblindFilter.removeFilter(canvas);

      window.removeEventListener(
        "health-change",
        handleHealthChange as EventListener,
      );
      window.removeEventListener(
        "altitude-change",
        handleAltitudeChange as EventListener,
      );
      window.removeEventListener(
        "inventory-change",
        handleInventoryChange as EventListener,
      );
      window.removeEventListener(
        "style-change",
        handleStyleChange as EventListener,
      );
      window.removeEventListener(
        "combo-update",
        handleComboUpdate as EventListener,
      );
      window.removeEventListener(
        "essence-change",
        handleEssenceChange as EventListener,
      );
      window.removeEventListener(
        "show-death-screen",
        handleDeathScreen as EventListener,
      );
      window.removeEventListener(
        "shop-open",
        handleShopOpen as EventListener,
      );
      window.removeEventListener(
        "flow-change",
        handleFlowChange as EventListener,
      );
      window.removeEventListener(
        "shield-guard-change",
        handleShieldGuardChange as EventListener,
      );
      window.removeEventListener(
        "sacred-ground-cooldown",
        handleSacredGroundCooldown as EventListener,
      );
      window.removeEventListener(
        "gambling-open",
        handleGamblingOpen as EventListener,
      );
      window.removeEventListener(
        "item-replace-prompt",
        handleItemReplacePrompt as EventListener,
      );
      window.removeEventListener(
        "coop-item-draft",
        handleCoopItemDraft as EventListener,
      );
      window.removeEventListener(
        "ascension-offer",
        handleAscensionOffer as EventListener,
      );
      window.removeEventListener(
        "ascension-chosen",
        handleAscensionChosen as EventListener,
      );
      window.removeEventListener(
        "subclass-offer",
        handleSubclassOffer as EventListener,
      );
      window.removeEventListener(
        "subclass-chosen",
        handleSubclassChosen as EventListener,
      );
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [gameSessionId]);

  // ── Training Room Phaser game lifecycle ──
  const trainingGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameState !== "TRAINING") {
      if (trainingGameRef.current) {
        trainingGameRef.current.destroy(true);
        trainingGameRef.current = null;
      }
      return;
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: "training-game",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 1000 },
          debug: false,
        },
      },
      scene: [TrainingScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    trainingGameRef.current = new Phaser.Game(config);

    const handleTrainingSceneExit = () => {
      if (trainingGameRef.current) {
        trainingGameRef.current.destroy(true);
        trainingGameRef.current = null;
      }
      setGameState("MAIN_MENU");
      setMenuScreen("main");
    };
    window.addEventListener("training-scene-exit", handleTrainingSceneExit);

    return () => {
      window.removeEventListener("training-scene-exit", handleTrainingSceneExit);
      if (trainingGameRef.current) {
        trainingGameRef.current.destroy(true);
        trainingGameRef.current = null;
      }
    };
  }, [gameState]);

  const handleTrainingExit = useCallback(() => {
    EventBus.emit("training-exit", {});
    if (trainingGameRef.current) {
      trainingGameRef.current.destroy(true);
      trainingGameRef.current = null;
    }
    setGameState("MAIN_MENU");
    setMenuScreen("main");
  }, []);

  // ── Boss Rush Phaser game lifecycle ──
  useEffect(() => {
    if (gameState !== "BOSS_RUSH") {
      if (bossRushGameRef.current) {
        bossRushGameRef.current.destroy(true);
        bossRushGameRef.current = null;
      }
      return;
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1920,
      height: 1080,
      parent: "boss-rush-game",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 1000 },
          debug: false,
        },
      },
      scene: [BossRushScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    bossRushGameRef.current = new Phaser.Game(config);

    // Listen for health/essence/inventory changes from boss rush scene
    const handleBRHealthChange = (e: CustomEvent) => {
      const idx = e.detail.playerIndex ?? 0;
      if (idx === 0) {
        setHealth(e.detail.health);
        if (e.detail.maxHealth) setMaxHealth(e.detail.maxHealth);
      }
    };
    const handleBREssenceChange = (e: CustomEvent) => {
      setEssence(e.detail.essence);
    };
    const handleBRInventoryChange = (e: CustomEvent) => {
      setInventory(e.detail.inventory);
    };
    const handleBRComboUpdate = (e: CustomEvent) => {
      setComboCount(e.detail.count);
      setComboMultiplier(e.detail.multiplier);
    };

    window.addEventListener("health-change", handleBRHealthChange as EventListener);
    window.addEventListener("essence-change", handleBREssenceChange as EventListener);
    window.addEventListener("inventory-change", handleBRInventoryChange as EventListener);
    window.addEventListener("combo-update", handleBRComboUpdate as EventListener);

    return () => {
      window.removeEventListener("health-change", handleBRHealthChange as EventListener);
      window.removeEventListener("essence-change", handleBREssenceChange as EventListener);
      window.removeEventListener("inventory-change", handleBRInventoryChange as EventListener);
      window.removeEventListener("combo-update", handleBRComboUpdate as EventListener);
      if (bossRushGameRef.current) {
        bossRushGameRef.current.destroy(true);
        bossRushGameRef.current = null;
      }
    };
  }, [gameState]);

  const handleBossRushExit = useCallback(() => {
    if (bossRushGameRef.current) {
      bossRushGameRef.current.destroy(true);
      bossRushGameRef.current = null;
    }
    // Reset HUD state
    setHealth(3);
    setMaxHealth(3);
    setEssence(0);
    setInventory([]);
    setComboCount(0);
    setComboMultiplier(1.0);
    setFlowMeter(0);
    setFlowMaxFlow(100);
    setIsShieldGuarding(false);
    setSacredGroundCooldown({ remaining: 0, total: 15000 });
    delete (window as any).__bossRushPending;
    setGameState("MAIN_MENU");
    setMenuScreen("main");
    setSelectedClass(null);
  }, []);

  return (
    <div
      className="App"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {gameState === "MAIN_MENU" && menuScreen === "main" && (
        <MainMenu
          onStartRun={handleStartRun}
          onResumeRun={handleResumeRun}
          hasSavedRun={hasSavedRun}
          savedRunInfo={savedRunInfo ?? undefined}
          onSettings={handleShowSettings}
          onExtras={handleShowExtras}
          onDailyChallenge={handleDailyChallenge}
          onCoopStart={handleCoopStart}
          onOnlineCoopStart={handleOnlineCoopStart}
          onTrainingRoom={handleTrainingRoom}
          onBossRush={handleBossRush}
          onEndlessMode={handleEndlessMode}
          onWeeklyChallenge={handleWeeklyChallenge}
          onAscensionTree={handleShowAscensionTree}
          onClassMastery={handleShowClassMastery}
        />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "stats" && (
        <StatsScreen onBack={handleBackToMenu} onRunHistory={handleShowRunHistory} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "collection" && (
        <CollectionGallery onBack={handleBackToMenu} onItemCodex={handleShowItemCodex} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "settings" && (
        <SettingsScreen onBack={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "cosmetics" && (
        <CosmeticScreen onBack={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "leaderboard" && (
        <LeaderboardScreen onBack={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "replay" && (
        <ReplayScreen
          onBack={handleBackToMenu}
          onWatch={handleWatchReplay}
        />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "run_history" && (
        <RunHistoryUI onBack={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "item_codex" && (
        <ItemCodexUI onBack={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "extras" && (
        <ExtrasScreen
          onClose={handleBackToMenu}
          onWatchReplay={handleWatchReplay}
        />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "online_lobby" && (
        <OnlineLobby
          onBack={handleBackToMenu}
          onStartGame={handleOnlineGameStart}
        />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "ascension_tree" && (
        <AscensionTreeUI onClose={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "class_mastery" && (
        <ClassMasteryUI onClose={handleBackToMenu} />
      )}
      {gameState === "MAIN_MENU" && menuScreen === "daily" && (
        <DailyChallengeScreen
          onBack={handleBackToMenu}
          onStartChallenge={handleStartDailyChallenge}
          onStartWeeklyChallenge={handleStartWeeklyChallenge}
        />
      )}
      {gameState === "CLASS_SELECT" && (
        <ClassSelect
          onSelect={handleClassSelect}
          playerLabel={isCoopMode ? (coopSelectingPlayer === 1 ? "PLAYER 1" : "PLAYER 2") : undefined}
        />
      )}
      {gameState === "EQUIP" && (
        <GoldItemEquip onConfirm={handleGoldEquipConfirm} />
      )}
      {gameState === "MODIFIERS" && (
        <RunModifierSelect onConfirm={handleModifiersConfirm} />
      )}
      {gameState === "TRAINING" && (
        <>
          <div id="training-game" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <TrainingUI onExit={handleTrainingExit} />
          </div>
        </>
      )}
      {gameState === "BOSS_RUSH" && (
        <>
          <div id="boss-rush-game" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <GameHUD
              health={health}
              maxHealth={maxHealth}
              altitude={0}
              inventory={inventory}
              className={selectedClass ? CLASSES[selectedClass].name : undefined}
              styleMeter={0}
              styleTier="D"
              essence={essence}
              comboCount={comboCount}
              comboMultiplier={comboMultiplier}
              flowMeter={flowMeter}
              flowMaxFlow={flowMaxFlow}
              isShieldGuarding={isShieldGuarding}
              sacredGroundCooldown={sacredGroundCooldown}
            />
            <BossRushUI onReturnToMenu={handleBossRushExit} />
          </div>
        </>
      )}
      {(gameState === "PLAYING" || gameState === "DEATH") && (
        <>
          <div id="phaser-game" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />
          {gameState === "PLAYING" && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                transform: GameSettings.get().largerUI ? "scale(1.15)" : undefined,
                transformOrigin: "top left",
                zIndex: 1,
              }}
            >
              <GameHUD
                health={health}
                maxHealth={maxHealth}
                altitude={altitude}
                inventory={inventory}
                className={selectedClass ? CLASSES[selectedClass].name : undefined}
                styleMeter={styleMeter}
                styleTier={styleTier}
                essence={essence}
                comboCount={comboCount}
                comboMultiplier={comboMultiplier}
                flowMeter={flowMeter}
                flowMaxFlow={flowMaxFlow}
                isShieldGuarding={isShieldGuarding}
                sacredGroundCooldown={sacredGroundCooldown}
                player2Health={isCoopMode ? health2 : undefined}
                player2MaxHealth={isCoopMode ? maxHealth2 : undefined}
                player2ClassName={isCoopMode && selectedClass2 ? CLASSES[selectedClass2].name : undefined}
              />
              <TouchControlsOverlay />
              {isPaused && (
                <PauseMenu
                  altitude={altitude}
                  elapsedTime={elapsedTime}
                  itemCount={inventory.length}
                  onResume={handleResume}
                  onRestart={handleRestart}
                  onQuit={handleQuit}
                />
              )}
              {shopOpen && (
                <ShopUI
                  offerings={shopOfferings}
                  essence={essence}
                  onPurchase={handleShopPurchase}
                  onClose={handleShopClose}
                />
              )}
              {gamblingOpen && (
                <GamblingUI
                  essence={essence}
                  onClose={handleGamblingClose}
                />
              )}
              {itemReplaceData && (
                <ItemReplaceUI
                  newItem={itemReplaceData.newItem}
                  currentItems={itemReplaceData.currentItems}
                  onTake={handleItemReplaceTake}
                  onLeave={handleItemReplaceLeave}
                />
              )}
              {coopDraftItems && (
                <CoopItemDraft
                  items={coopDraftItems}
                  onComplete={handleCoopDraftComplete}
                />
              )}
              {tutorialHint && (
                <TutorialOverlay
                  hint={tutorialHint}
                  onDismiss={() => {
                    TutorialManager.hideHint();
                    setTutorialHint(null);
                  }}
                />
              )}
              {ascensionOpen && (
                <AscensionScreen
                  bossNumber={ascensionBossNumber}
                  onChosen={handleAscensionChosen}
                />
              )}
              {subclassSelectOpen && selectedClass && (
                <SubclassSelect
                  classType={selectedClass}
                  onSelect={handleSubclassSelect}
                />
              )}
            </div>
          )}
          {gameState === "DEATH" && deathStats && (
            <DeathScreen
              {...deathStats}
              onRetry={handleDeathRetry}
              onMainMenu={handleQuit}
            />
          )}
        </>
      )}
      {replayPlaying && (
        <PlaybackControls onStop={handleStopPlayback} />
      )}
      {isOnlineMode && gameState === "PLAYING" && (
        <ConnectionStatus
          latency={onlineLatency}
          connectionState={onlineConnectionState}
          role={NetworkManager.isHost() ? "host" : "guest"}
          roomCode={onlineRoomCode}
        />
      )}
      <AchievementPopup
        achievement={achievementPopup}
        onDone={() => setAchievementPopup(null)}
      />
      {GameSettings.get().showFPS && (
        <div style={{
          position: 'fixed',
          top: 4,
          right: 4,
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 9999,
          opacity: 0.7,
          pointerEvents: 'none',
        }}>
          {fps} FPS
        </div>
      )}
    </div>
  );
}

export default App;
