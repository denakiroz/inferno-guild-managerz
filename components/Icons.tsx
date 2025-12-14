
import React from 'react';
import { 
  Sword, Shield, Zap, Heart, Crosshair, 
  Users, Calendar, Activity, Home, Menu, 
  ChevronRight, LogOut, CheckCircle, XCircle, AlertTriangle, Share2, Coffee,
  Filter, X, Trophy, Skull, Trash2, Map, Plus, Image,
  Pen,
  Redo,
  ClipboardCopy
} from 'lucide-react';
import { CharacterClass } from '../types';

export const CLASS_DATA: Record<CharacterClass, { img: string; color: string }> = {
  Ironclan: { 
    img: 'https://img2.pic.in.th/pic/ironclan.jpg', 
    color: 'border-yellow-500 shadow-yellow-500/20' 
  },
  Bloodstorm: { 
    img: 'https://img2.pic.in.th/pic/bloodstrom.jpg', 
    color: 'border-red-600 shadow-red-600/20' 
  },
  Celestune: { 
    img: 'https://img5.pic.in.th/file/secure-sv1/celestune.jpg', 
    color: 'border-blue-500 shadow-blue-500/20' 
  },
  Sylph: { 
    img: 'https://img5.pic.in.th/file/secure-sv1/sylpe.jpg', 
    color: 'border-pink-500 shadow-pink-500/20' 
  },
  Numina: { 
    img: 'https://img5.pic.in.th/file/secure-sv1/Numina.jpg', 
    color: 'border-purple-500 shadow-purple-500/20' 
  },
  Nightwalker: { 
    img: 'https://img2.pic.in.th/pic/nightwalk.jpg', 
    color: 'border-cyan-500 shadow-cyan-500/20' 
  }
};

export const ClassIcon = ({ type, size = 32 }: { type: CharacterClass; size?: number }) => {
  const data = CLASS_DATA[type] || CLASS_DATA['Ironclan'];
  
  return (
    <div 
      className={`relative rounded-full border-2 p-0.5 bg-white ${data.color} transition-transform hover:scale-105`}
      style={{ width: size, height: size }}
    >
      <img 
        src={data.img} 
        alt={type} 
        className="w-full h-full object-cover rounded-full"
      />
    </div>
  );
};

export const Icons = {
  Home,
  Users,
  Calendar,
  Activity,
  Menu,
  ChevronRight,
  LogOut,
  Leave: Coffee, // Alias for the requested mug-saucer concept
  CheckCircle,
  XCircle,
  Alert: AlertTriangle,
  Sword,
  Shield,
  Heart,
  Zap,
  Crosshair,
  Share2,
  Filter,
  X,
  Trophy,
  Skull,
  Trash: Trash2,
  Map,
  Plus,
  Edit: Pen, // fa-pen-to-square equivalent
  Image,
  Redo : Redo,
  ClipboardCopy : ClipboardCopy
};
