import { registerRootComponent } from 'expo';
import React from 'react';
import { SafeAreaView, Text, ScrollView } from 'react-native';
import App from './App';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: 'red', fontSize: 24, fontWeight: 'bold', marginBottom: 15 }}>Falha ao iniciar</Text>
          <ScrollView>
            <Text style={{ color: 'orange', fontSize: 14, marginBottom: 20 }}>
              {this.state.error && this.state.error.toString()}
            </Text>
            <Text style={{ color: 'gray', fontSize: 12 }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

registerRootComponent(Root);
