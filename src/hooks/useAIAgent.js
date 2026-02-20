import axios from "axios";
import { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

export const useAIRecommendations = (userAddress, preferences = {}) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecommendations = async () => {
    if (!userAddress) {
      setError("User address required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = {
        userAddress,
        diet: preferences.diet || "balanced",
        budget: preferences.budget,
        householdSize: preferences.householdSize || 1
      };

      const response = await axios.get(`${API_BASE}/recommendations`, { params });
      setRecommendations(response.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [userAddress]);

  return { recommendations, loading, error, refetch: fetchRecommendations };
};

export const useFoodProviders = () => {
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_BASE}/food-providers`)
      .then(res => setProviders(res.data.providers))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { providers, loading, error };
};

export const executePurchase = async (userAddress, merchant, amount) => {
  try {
    const response = await axios.post(`${API_BASE}/execute-purchase`, {
      userAddress,
      merchant,
      amount
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
