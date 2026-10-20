export const PLATFORM_FEATURES = {
  eventCreation: { label: 'Création d’événements', description: 'Autoriser les organisateurs à créer de nouveaux événements.' },
  onlineSales: { label: 'Ventes en ligne', description: 'Autoriser les commandes et paiements en ligne.' },
  physicalSales: { label: 'Ventes au guichet', description: 'Autoriser les ventes physiques par les équipes.' },
  ticketTransfers: { label: 'Transferts de billets', description: 'Autoriser les demandes et acceptations de transfert.' },
  offlineScanning: { label: 'Scan hors ligne', description: 'Autoriser le téléchargement des packs et la synchronisation des scans hors ligne.' },
  inAppNotifications: { label: 'Notifications dans l’application', description: 'Activer le centre de notifications TYPS.' }
} as const

export type PlatformFeature = keyof typeof PLATFORM_FEATURES
export type PlatformFeatureFlags = Record<PlatformFeature, boolean>
export const DEFAULT_PLATFORM_FEATURES: PlatformFeatureFlags = {
  eventCreation: true,
  onlineSales: true,
  physicalSales: true,
  ticketTransfers: true,
  offlineScanning: true,
  inAppNotifications: true
}
