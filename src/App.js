import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  limit,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "./Config";

const App = () => {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [remaining, setRemaining] = useState("");
  const [image, setImage] = useState(null);
  const [editProductId, setEditProductId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  const todoRef = collection(db, "products");

  useEffect(() => {
    const unsubscribe = onSnapshot(todoRef, (querySnapshot) => {
      const products = [];
      querySnapshot.forEach((doc) => {
        const productData = doc.data();
        products.push({
          id: doc.id,
          ...productData,
        });
      });
      setProducts(products);
    });

    return () => unsubscribe();
  }, []);

  const fetchOrders = async (startAfterDoc = null) => {
    setLoading(true);
    let q = query(collection(db, "orders"), limit(20));
    if (startAfterDoc) {
      q = query(collection(db, "orders"), startAfter(startAfterDoc), limit(20));
    }

    const querySnapshot = await getDocs(q);
    const newOrders = [];
    let lastVisible = null;

    querySnapshot.forEach((doc) => {
      const orderData = doc.data();
      newOrders.push({
        id: doc.id,
        ...orderData,
      });
      lastVisible = doc;
    });

    const fetchCartData = async (order) => {
      const cartCollection = collection(db, "cart");
      const cartQuery = query(
        cartCollection,
        where("userEmail", "==", order.email)
      );
      const cartSnapshot = await getDocs(cartQuery);
      const cartData = cartSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      return cartData;
    };

    for (let order of newOrders) {
      order.cart = await fetchCartData(order);
    }

    setOrders((prevOrders) => {
      const orderMap = {};
      [...prevOrders, ...newOrders].forEach((order) => {
        orderMap[order.id] = order;
      });
      return Object.values(orderMap);
    });
    setLastDoc(lastVisible);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleImageChange = async (e) => {
    if (e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const uploadImage = async (file) => {
    const storageRef = ref(storage, file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        () => {},
        (error) => {
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleProductSubmit = async () => {
    if (cost && description && name && remaining && image) {
      try {
        const imageUrl = await uploadImage(image);
        const productData = {
          cost: parseFloat(cost),
          description,
          name,
          quantity: 1,
          remaining: parseInt(remaining),
          image: imageUrl,
        };

        if (editProductId) {
          const productRef = doc(todoRef, editProductId);
          await updateDoc(productRef, productData);
        } else {
          await addDoc(todoRef, productData);
        }

        setCost("");
        setDescription("");
        setName("");
        setRemaining("");
        setImage(null);
        setEditProductId(null);
        setModalVisible(false);
      } catch (error) {
        alert("Error: " + error.message);
      }
    } else {
      alert("Please fill all the fields");
    }
  };

  const renderProduct = useCallback(
    (item) => (
      <div
        style={{ border: "1px solid #ccc", margin: "10px", padding: "10px" }}
      >
        <h4 style={{ color: "#3f51b5" }}>{item.name}</h4>
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            style={{ width: 100, height: 100 }}
          />
        )}
        <p>Cost: {item.cost}</p>
        <p>Description: {item.description}</p>
        <p>Quantity: {item.quantity}</p>
        <p>Remaining: {item.remaining}</p>
        <button
          style={{
            backgroundColor: "#f50057",
            color: "#fff",
            border: "none",
            padding: "10px",
            cursor: "pointer",
          }}
          onClick={() => deleteProduct(item.id)}
        >
          Delete
        </button>
      </div>
    ),
    []
  );

  const editProduct = (product) => {
    setCost(product.cost.toString());
    setDescription(product.description);
    setName(product.name);
    setRemaining(product.remaining.toString());
    setImage(product.image);
    setEditProductId(product.id);
    setModalVisible(true);
  };

  const deleteProduct = async (id) => {
    try {
      await deleteDoc(doc(todoRef, id));
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const deleteOrder = async (id) => {
    setLoading(true);
    try {
      await deleteDoc(doc(collection(db, "orders"), id));
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search"
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            width: "calc(100% - 20px)",
          }}
        />
        <button
          style={{
            backgroundColor: "#3f51b5",
            color: "#fff",
            border: "none",
            padding: "10px",
            cursor: "pointer",
            marginLeft: "10px",
          }}
          onClick={() => setModalVisible(true)}
        >
          Add Product
        </button>
      </div>
      <div style={{ margin: "20px 0" }}>
        <h2 style={{ color: "#3f51b5" }}>Products Details</h2>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          {products.map((product) => (
            <div key={product.id} style={{ flex: "1 0 21%", margin: "10px" }}>
              {renderProduct(product)}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 style={{ color: "#3f51b5" }}>Order Details</h2>
        {loading && <div>Loading...</div>}
        <div>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                border: "1px solid #ccc",
                margin: "10px 0",
                padding: "10px",
              }}
            >
              <p>
                Order No: <strong>{order.orderNo}</strong>
              </p>
              <p>
                Grand Total:{" "}
                <strong style={{ color: "green" }}>
                  Ksh {order.grandTotal}
                </strong>
              </p>
              <p>
                Postal Address: <strong>{order.code}</strong>
              </p>
              <p>
                Phone: <strong>{order.phone}</strong>
              </p>
              <p>
                Txn ref: <strong>{order.mpesaCode}</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {order.cart.map((item) => (
                  <div
                    key={item.id}
                    style={{ flex: "1 0 45%", margin: "10px" }}
                  >
                    <p>Product Name: {item.name}</p>
                    <p>Product Quantity: {item.quantity}</p>
                  </div>
                ))}
              </div>
              <button
                style={{
                  backgroundColor: "#f50057",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  cursor: "pointer",
                }}
                onClick={() => deleteOrder(order.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <div>
          <button
            style={{
              backgroundColor: "#3f51b5",
              color: "#fff",
              border: "none",
              padding: "10px",
              cursor: "pointer",
              marginRight: "10px",
            }}
            onClick={() => fetchOrders()}
          >
            Previous
          </button>
          <button
            style={{
              backgroundColor: "#3f51b5",
              color: "#fff",
              border: "none",
              padding: "10px",
              cursor: "pointer",
            }}
            onClick={() => fetchOrders(lastDoc)}
            disabled={!lastDoc}
          >
            Next
          </button>
        </div>
      </div>
      {modalVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "8px",
              width: "400px",
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3>{editProductId ? "Edit Product" : "Add Product"}</h3>
            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
              <input
                type="number"
                placeholder="Cost"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
              <input
                type="number"
                placeholder="Remaining"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
              <input
                type="file"
                onChange={handleImageChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginBottom: "10px",
                }}
              />
              {image && (
                <img
                  src={URL.createObjectURL(image)}
                  alt="Preview"
                  style={{ width: "100%", marginTop: "10px" }}
                />
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                style={{
                  backgroundColor: "#3f51b5",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  cursor: "pointer",
                  marginRight: "10px",
                }}
                onClick={handleProductSubmit}
              >
                Submit
              </button>
              <button
                style={{
                  backgroundColor: "#f50057",
                  color: "#fff",
                  border: "none",
                  padding: "10px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setModalVisible(false);
                  setEditProductId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
