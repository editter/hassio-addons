import { Request } from 'express';


export interface Features {
  device: string;
  smartphone: string;
  nonSmartphoneLocating: string;
  geofencing: string;
  shareLocation: string;
  shareOffTimestamp?: any;
  disconnected: string;
  pendingInvite: string;
  mapDisplay: string;
}

export interface Issues {
  disconnected: string;
  type?: any;
  status?: any;
  title?: any;
  dialog?: any;
  action?: any;
  troubleshooting: string;
}

export interface Location {
  latitude: string;
  longitude: string;
  accuracy: string;
  startTimestamp: number;
  endTimestamp: string;
  since: number;
  timestamp: string;
  name: string;
  placeType?: any;
  source: string;
  sourceId: string;
  address1: string;
  address2: string;
  shortAddress: string;
  inTransit: string;
  tripId?: any;
  driveSDKStatus?: any;
  battery: string;
  charge: string;
  wifiState: string;
  speed: number;
  isDriving: string;
}

interface Communication {
  channel: string;
  value: string;
  type: string;
}

export interface Member {
  features: Features;
  issues: Issues;
  location: Location;
  communications: Communication[];
  medical?: any;
  relation?: any;
  createdAt: string;
  activity?: any;
  id: string;
  firstName: string;
  lastName: string;
  loginEmail: string;
  loginPhone: string;
  avatar: string;
  isAdmin: string;
  pinNumber?: any;
}

export interface Features {
  ownerId?: any;
  skuId?: any;
  premium: string;
  locationUpdatesLeft: number;
  priceMonth: string;
  priceYear: string;
  skuTier?: any;
}

export interface Circle {
  id: string;
  name: string;
  color: string;
  type: string;
  createdAt: string;
  memberCount: string;
  unreadMessages: string;
  unreadNotifications: string;
  features: Features;
}

export interface Place {
  id: string;
  ownerId: string;
  circleId: string;
  name: string;
  latitude: string;
  longitude: string;
  radius: string;
  type?: any;
  typeLabel?: any;
}

export interface Life360Request {
  errorMessage?: string;
  status?: number;
}

export interface PlacesRequest extends Life360Request {
  places: Place[];
}

export interface PlacesRequest extends Life360Request {
  places: Place[];
}

export interface CirclesRequest extends Life360Request {
  circles: Circle[];
}

export interface MembersRequest extends Life360Request {
  members: Member[];
}

export interface TokenRequest extends Life360Request {
  access_token: string;
  token_type: string;
}
