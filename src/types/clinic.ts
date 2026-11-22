export type Language = 'ar' | 'en';

export type NavTab = 'build' | 'furniture' | 'equipment' | 'decor' | 'missions' | 'store';

export type RoomSpecialty =
  | 'reception'
  | 'electrotherapy'
  | 'kinesiotherapy'
  | 'orthopedics'
  | 'neurorehab'
  | 'hydrotherapy';

export type ItemCategory = 'build' | 'furniture' | 'equipment' | 'decor';

export type SpriteKind =
  | 'reception_desk'
  | 'waiting_chairs'
  | 'coffee_table'
  | 'water_cooler'
  | 'file_cabinet'
  | 'treatment_bed'
  | 'tens_unit'
  | 'ultrasound_unit'
  | 'traction_table'
  | 'treadmill'
  | 'exercise_bike'
  | 'wall_bars'
  | 'ball_rack'
  | 'exercise_mat'
  | 'parallel_bars'
  | 'hydro_sink'
  | 'shockwave_eswt'
  | 'laser_hilt'
  | 'swd_unit'
  | 'cpm_device'
  | 'cryo_unit'
  | 'balance_trainer'
  | 'emg_biofeedback'
  | 'paraffin_bath'
  | 'infrared_lamp'
  | 'magnetotherapy'
  | 'tilt_table'
  | 'multi_gym_pulley'
  | 'hand_rehab_table'
  | 'pt_toolkit_cart'
  | 'potted_plant'
  | 'park_bench'
  | 'garden_lamp'
  | 'garden_spot_lamp'
  | 'flower_bed'
  | 'therason_sign'
  | 'partition_wall'
  | 'privacy_screen'
  | 'wood_slat_divider'
  | 'sanitizing_kiosk'
  | 'arch_pergola'
  | 'anatomy_poster'
  | 'office_desk'
  | 'corner_desk'
  | 'supply_shelf'
  | 'med_cabinet'
  | 'lounge_chair'
  | 'luxury_chair'
  | 'ac_nesma'
  | 'ac_lg'
  | 'wheelchair_bay'
  | 'doctor_stool'
  | 'skeleton_stand'
  | 'clinic_floor_lamp'
  | 'wall_sconce_lamp'
  | 'table_lamp'
  | 'waste_bin'
  | 'floor_rug'
  | 'outdoor_tree'
  | 'street_lamp_post'
  | 'solar_panel'
  | 'royal_palm'
  | 'marble_fountain'
  | 'rose_trellis'
  | 'zen_lantern'
  | 'garden_gazebo'
  | 'stone_pathway'
  | 'hedge_planter'
  | 'olive_tree'
  | 'garden_umbrella_table'
  | 'wall_clock'
  | 'reception_display_stand';

export type LightingMode = 'day' | 'night';

export interface CatalogItem {
  id: string;
  sprite: SpriteKind;
  category: ItemCategory;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  priceCoins: number;
  priceStars?: number;
  width: number; // grid footprint X
  depth: number; // grid footprint Y
  satisfactionBonus: number;
  speedBonus: number; // % treatment speed or capacity value
  isTreatmentStation?: boolean;
  stationSpecialty?: RoomSpecialty | 'any';
  outdoorAllowed?: boolean;
  indoorAllowed?: boolean;
  isWallDecor?: boolean;
  isSolarPanel?: boolean;
}

export interface PlacedItem {
  instanceId: string;
  catalogId: string;
  gridX: number;
  gridY: number;
  rotation: 0 | 1 | 2 | 3; // 0 = default, 1 = 90deg, 2 = 180deg, 3 = 270deg
  roomId: string;
}

export interface ClinicRoom {
  id: string;
  nameAr: string;
  nameEn: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  unlocked: boolean;
  unlockCost: number;
  specialty: RoomSpecialty | null;
  floorTheme: 'tile_blue' | 'gym_royal' | 'tile_mint' | 'wood_warm' | 'locked';
}

export type StaffRole = 'receptionist' | 'therapist';

export interface StaffMember {
  id: string;
  role: StaffRole;
  nameAr: string;
  nameEn: string;
  hired: boolean;
  hireCost: number;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  path: Array<{ x: number; y: number }>;
  skinTone: string;
  hairColor: string;
  scrubColor: string;
  facing: number; // 0..3
  walkPhase: number;
  state: 'idle' | 'walking' | 'assisting';
}

export interface ObjectiveTest {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'rom' | 'mmt' | 'special' | 'palpation';
  findingAr: string;
  findingEn: string;
  isPositive: boolean;
}

export interface ClinicalCase {
  id: string;
  specialty: RoomSpecialty;
  patientNameAr: string;
  patientNameEn: string;
  age: number;
  gender: 'male' | 'female';
  occupationAr: string;
  occupationEn: string;
  chiefComplaintAr: string;
  chiefComplaintEn: string;
  vasPain: number; // 0-10
  onsetAr: string;
  onsetEn: string;
  aggravatingAr: string;
  aggravatingEn: string;
  easingAr: string;
  easingEn: string;
  redFlagsPresent: boolean;
  redFlagClueAr: string;
  redFlagClueEn: string;
  objectiveTests: ObjectiveTest[];
  diagnosisOptions: Array<{
    id: string;
    labelAr: string;
    labelEn: string;
    isCorrect: boolean;
  }>;
  treatmentOptions: Array<{
    id: string;
    labelAr: string;
    labelEn: string;
    isRecommended: boolean;
  }>;
  clinicalPearlAr: string;
  clinicalPearlEn: string;
  vitals?: {
    bp: string;
    hr: number;
    spo2: number;
    temp: string;
  };
  mobilityAid?: 'none' | 'cane' | 'crutches';
}

export type PatientState =
  | 'arriving'
  | 'checkin_at_desk'
  | 'walking_to_water'
  | 'drinking_water'
  | 'walking_to_wait'
  | 'waiting_checkin'
  | 'walking_to_station'
  | 'ready_for_exam'
  | 'in_exam'
  | 'in_treatment'
  | 'treated_leaving';

export type CharacterPose = 'standing' | 'seated' | 'lying';

export type FppPatientPosture =
  | 'standing'
  | 'sitting'
  | 'supine'
  | 'prone'
  | 'right_side'
  | 'left_side';

export type FppTargetRegion = 'cervical' | 'shoulder' | 'lumbar' | 'knee';

export type FppBedSide = 'front' | 'back';

export interface FppProbeAnchor {
  id: string;
  label?: string;
  bayX: number;
  bayY: number;
  bayZ: number;
  nx?: number;
  ny?: number;
  nz?: number;
  boneName?: string;
  blx?: number;
  bly?: number;
  blz?: number;
  bnx?: number;
  bny?: number;
  bnz?: number;
  placed: boolean;
}

export interface DeviceConsoleParams {
  intensity?: number;
  freqHz?: number;
  pulseUs?: number;
  dutyPct?: number;
  timerMin?: number;
  timerRemainingSec?: number;
  tempC?: number;
  mode?: string;
  flexDeg?: number;
  extDeg?: number;
  speed?: number;
  tipSize?: string;
  shocks?: number;
  deliveredShocks?: number;
  pressureMmHg?: number;
  flow?: string;
  tool?: string;
  magnetZone?: string;
  ringPosCm?: number;
  tiltDeg?: number;
  currentTiltDeg?: number;
}

export interface PatientAttachedDevice {
  instanceId: string;
  catalogId: string;
  sprite: SpriteKind;
  nameEn: string;
  nameAr: string;
  region: FppTargetRegion;
  side: FppBedSide;
  closeRange: boolean;
  isRunning: boolean;
  placedX: number;
  placedY: number;
  placedZ: number;
  placedRotY: number;
  irIntensity?: number;
  irHeightOffset?: number;
  irLateralOffset?: number;
  irDistance?: number;
  deviceParams?: DeviceConsoleParams;
  probeAnchors?: FppProbeAnchor[];
}

export interface FppActiveDeviceState {
  instanceId?: string;
  catalogId: string;
  sprite: SpriteKind;
  nameEn: string;
  nameAr: string;
  region: FppTargetRegion;
  side: FppBedSide;
  closeRange: boolean;
  isRunning: boolean;
  placementMode: 'bed' | 'room';
  hasScreen?: boolean;
  screenTapped?: boolean;
  visualRightSign?: 1 | -1;
  irIntensity?: number;
  irHeightOffset?: number;
  irLateralOffset?: number;
  irDistance?: number;
  deviceParams?: DeviceConsoleParams;
  probeAnchors?: FppProbeAnchor[];
  selectedProbeId?: string | null;
  supportsProbes?: boolean;
}

export interface FppNearbyDeviceInfo {
  instanceId?: string;
  catalogId: string;
  sprite: SpriteKind;
  nameEn: string;
  nameAr: string;
  canDeploy: boolean;
  isStationConsole?: boolean;
  isActive: boolean;
  isAdjustable: boolean;
  supportsDistance: boolean;
  requiredPosture?: FppPatientPosture;
}

export interface FppHeldDeviceInfo {
  instanceId?: string;
  catalogId: string;
  sprite: SpriteKind;
  nameEn: string;
  nameAr: string;
  nearBed: boolean;
  nearBedRegion?: FppTargetRegion;
  nearBedPostureBlocked?: boolean;
  requiredPosture?: FppPatientPosture;
}

export interface FppDeviceCommandApi {
  grabDevice: (deviceId: string) => void;
  placeHeldDevice: () => void;
  returnDevice: (deviceId: string) => void;
  updateActiveBedDevice: (next: FppActiveDeviceState) => void;
  openStationConsole?: (deviceId: string) => void;
  triggerHandshake?: () => void;
}

export interface PatientEntity {
  id: string;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  path: Array<{ x: number; y: number }>;
  walkPhase: number;
  facing: number;
  skinTone: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  hasHijab?: boolean;
  hasBeard?: boolean;
  hasTurban?: boolean;
  outfitStyle?: 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress' | 'sudanese_thobe';
  shirtStyle?: 'tshirt' | 'shirt';
  heightScale?: number;
  pose?: CharacterPose;
  state: PatientState;
  assignedStationId: string | null;
  waitTimer: number;
  seatOffsetX?: number;
  seatOffsetZ?: number;
  seatApproachX?: number;
  seatApproachY?: number;
  seatFacingRad?: number;
  seatHeight?: number;
  isSeatedWait?: boolean;
  waitingSeatKey?: string;
  waterCoolerId?: string;
  leavingItemId?: string;
  idleMoveTimer?: number;
  headingRad?: number;
  blockedTicks?: number;
  treatmentProgress?: number; // 0..1 while in_treatment
  pendingReward?: {
    coins: number;
    stars: number;
    satisfactionDelta: number;
    caughtRedFlag: boolean;
  };
  clinicalCase: ClinicalCase;
  isAiGenerated?: boolean;
  modelKey?: string;
  attachedDevices?: PatientAttachedDevice[];
  sessionPosture?: FppPatientPosture;
}

export interface Mission {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  type: 'treat_patients' | 'buy_equipment' | 'unlock_room' | 'red_flag_catch' | 'visit_friend';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardStars: number;
  claimed: boolean;
}

export interface FriendClinic {
  id: string;
  nameAr: string;
  nameEn: string;
  universityAr: string;
  universityEn: string;
  level: number;
  stars: number;
  satisfaction: number;
  online: boolean;
  giftedToday: boolean;
  avatarColor: string;
  rooms: ClinicRoom[];
  placedItems: PlacedItem[];
}

export interface FloatingFeedback {
  id: string;
  gridX: number;
  gridY: number;
  text: string;
  color: string;
  createdAt: number;
}

export type PlayerGender = 'male' | 'female';

export type PlayerOutfitId =
  | 'lab_coat'
  | 'scrubs'
  | 'shirt_pants'
  | 'female_abaya_closed'
  | 'female_abaya_light'
  | 'female_abaya_niqab';

export interface PlayerCharacterConfig {
  gender: PlayerGender;
  outfitId: PlayerOutfitId;
  hasTarha: boolean;
}

export interface ClinicSaveState {
  version: number;
  studentId: string;
  clinicName: string;
  language: Language;
  soundEnabled: boolean;
  lightingMode?: LightingMode;
  coins: number;
  stars: number;
  xp?: number;
  level?: number;
  satisfaction: number;
  patientsTreatedTotal: number;
  redFlagsCaughtTotal: number;
  rooms: ClinicRoom[];
  placedItems: PlacedItem[];
  removedTreeIds?: string[];
  staff: StaffMember[];
  playerProfile?: PlayerCharacterConfig;
  missions: Mission[];
  lastSyncedAt: string | null;
}
