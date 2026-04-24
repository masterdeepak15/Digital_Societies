import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router }       from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import RoleRouter       from '../../src/navigation/RoleRouter';
import { useAuthStore } from '../../src/store/authStore';
import { authService }  from '../../src/services/api/authService';
import { Colors }       from '../../src/theme/colors';

/**
 * App shell — guards all (app) routes.
 *
 * Two cases:
 *  1. Fresh login — `isAuthenticated` is already true (set by LoginScreen).
 *  2. App restart 