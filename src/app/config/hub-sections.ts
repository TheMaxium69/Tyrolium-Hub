/**
 * Onglets du Hub et permission "view" requise pour chacun.
 * Les noms de rôles sont ceux de tyrolium-api : préfixe PERMS_, majuscules, points → underscores.
 * Les actions d'un domaine utilisent `${role sans _VIEW}_CREATE | _UPDATE | _DELETE` (voir HubAuthService.can()).
 */
export interface IHubSection {
  path:    string;
  label:   string;
  labelEn: string;
  icon:    string;
  /** Rôle requis pour voir l'onglet. */
  role:    string;
  group:   'tyrolium' | 'useritium' | 'solidserv' | 'support';
  /** false tant que tyrolium-api n'expose pas encore les routes du domaine. */
  ready:   boolean;
}

/** Groupes affichés en catégorie dans la sidebar (les autres sections sont des liens directs). */
export const HUB_CATEGORIES: { group: IHubSection['group']; label: string; iconImg: string }[] = [
  { group: 'tyrolium',  label: 'Tyrolium',  iconImg: 'assets/tyrolium-ui/projects/Tyrolium.png'  },
  { group: 'useritium', label: 'Useritium', iconImg: 'assets/tyrolium-ui/projects/Useritium.png' },
  // Filiale à plusieurs modules (Produits ; Dashboard, Statut, Proxmox, Logs à venir).
  { group: 'solidserv', label: 'SolidServ', iconImg: 'assets/tyrolium-ui/projects/SolidServ.png' },
];

export const HUB_SECTIONS: IHubSection[] = [
  { path: 'analytics',   label: 'Analytics',   labelEn: 'Analytics',     icon: 'ri-line-chart-line',       role: 'PERMS_TYROLIUM_ANALYTICS_VIEW',  group: 'tyrolium',  ready: true  },
  { path: 'offres',      label: 'Offres',      labelEn: 'Offers',        icon: 'ri-price-tag-3-line',      role: 'PERMS_TYROLIUM_OFFRE_VIEW',      group: 'tyrolium',  ready: true  },
  { path: 'prestations', label: 'Prestations', labelEn: 'Services',      icon: 'ri-briefcase-4-line',      role: 'PERMS_TYROLIUM_PRESTATION_VIEW', group: 'tyrolium',  ready: true  },
  // Réservées au owner (hasRole laisse passer ROLE_OWNER, seul compte à l'avoir).
  { path: 'permissions', label: 'Permissions', labelEn: 'Permissions',   icon: 'ri-shield-keyhole-line',   role: 'ROLE_OWNER',                     group: 'tyrolium',  ready: true  },
  { path: 'cles-api',    label: 'Clés API',    labelEn: 'API keys',      icon: 'ri-key-2-line',            role: 'ROLE_OWNER',                     group: 'tyrolium',  ready: true  },
  { path: 'websites',    label: 'Sites web',   labelEn: 'Websites',      icon: 'ri-global-line',           role: 'PERMS_TYROLIUM_WEBSITE_VIEW',    group: 'tyrolium',  ready: true  },
  { path: 'utilisateurs', label: 'Utilisateurs', labelEn: 'Users',       icon: 'ri-group-line',            role: 'PERMS_USERITIUM_USER_VIEW',      group: 'useritium', ready: true  },
  { path: 'solidserv/produits',  label: 'Produits',          labelEn: 'Products',     icon: 'ri-shopping-bag-3-line', role: 'PERMS_SOLIDSERV_PRODUCT_VIEW',    group: 'solidserv', ready: true  },
  { path: 'solidserv/dashboard', label: 'Dashboard',         labelEn: 'Dashboard',    icon: 'ri-server-line',         role: 'PERMS_SOLIDSERV_SERVER_VIEW',     group: 'solidserv', ready: true  },
  { path: 'solidserv/types',     label: 'Types de serveurs', labelEn: 'Server types', icon: 'ri-stack-line',          role: 'PERMS_SOLIDSERV_SERVERTYPE_VIEW', group: 'solidserv', ready: true  },
  { path: 'support',     label: 'Support',     labelEn: 'Support',       icon: 'ri-customer-service-2-line', role: 'PERMS_SUPPORT_AGENT',          group: 'support',   ready: false },
];
