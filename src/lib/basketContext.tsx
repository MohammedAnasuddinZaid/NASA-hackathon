import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BASKET_KEY,
  editBasket,
  loadBasket,
  persistBasket,
  snapshot,
  type BasketSnapshot,
} from './basket';
import { researchSource } from './researchData';

interface BasketContextValue {
  state: BasketSnapshot;
  notices: string[];
  storageError: boolean;
  dispatch: (action: Parameters<typeof editBasket>[1]) => void;
}
const Context = createContext<BasketContextValue>({
  state: snapshot([], researchSource),
  notices: [],
  storageError: false,
  dispatch: () => {},
});
function initial() {
  try {
    return { ...loadBasket(localStorage.getItem(BASKET_KEY), researchSource), storageError: false };
  } catch {
    return { ...loadBasket(null, researchSource), storageError: true };
  }
}
export function BasketProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(initial);
  const [state, setState] = useState(loaded.snapshot);
  const [notices, setNotices] = useState(loaded.notices);
  const [storageError, setStorageError] = useState(loaded.storageError);
  useEffect(() => {
    try {
      setStorageError(!persistBasket(state, localStorage));
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== BASKET_KEY && event.key !== null) return;
      const next = loadBasket(event.newValue, researchSource);
      setState(next.snapshot);
      setNotices(next.notices);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(
    () => ({
      state,
      notices,
      storageError,
      dispatch: (action: Parameters<typeof editBasket>[1]) => {
        setState((current) => editBasket(current, action, researchSource));
        if (action.type === 'review')
          setNotices([
            'Current dataset review acknowledged. Saved IDs refer to the current corpus.',
          ]);
        if (action.type === 'clear') setNotices([]);
      },
    }),
    [state, notices, storageError],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBasket() {
  return useContext(Context);
}
export function BasketIndicator() {
  const { state } = useBasket();
  return (
    <a
      className="basket-indicator"
      href="#/exports"
      aria-label={`Evidence basket: ${state.ids.length} records`}
    >
      Basket ({state.ids.length})
    </a>
  );
}
export function BasketButton({ id }: { id: string }) {
  const { state, dispatch } = useBasket();
  const added = state.ids.includes(id);
  return (
    <button
      className="text-link"
      aria-pressed={added}
      aria-label={`${added ? 'Remove' : 'Add'} ${id} ${added ? 'from' : 'to'} basket`}
      onClick={(event) => {
        event.stopPropagation();
        dispatch({ type: added ? 'remove' : 'add', id });
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {added ? 'In basket · remove' : '+ Basket'}
    </button>
  );
}
