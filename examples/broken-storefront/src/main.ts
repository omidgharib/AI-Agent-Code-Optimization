import "./style.css";
import { formatPrice, calculateDiscount } from "./pricing";
import { featuredProducts } from "./products";
import { unusedPromotion } from "./unusedPromotion";

type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
};

var selectedCategory = "all";
let heading = "Featured products";

const products: Product[] = featuredProducts;
const debugLabel = "catalog-ready";

function renderProducts(items: Product[]): void {
  const root = document.querySelector<HTMLDivElement>("#products");
  if (!root) return;

  root.innerHTML = items
    .map(
      (product) => `
        <article class="product-card">
          <img src="${product.image}">
          <div class="product-copy">
            <h3>${product.name}</h3>
            <p>${formatPrice(product.price)}</p>
            <button onclick="window.addToCart(${product.id})">Add to cart</button>
          </div>
        </article>`,
    )
    .join("");
}

declare global {
  interface Window {
    addToCart: (id: number) => void;
  }
}

window.addToCart = (id: number) => {
  if (id == 0) {
    console.log("Invalid product");
  }
  const product = products.find((item) => item.id === id);
  alert(product ? `${product.name} added` : "Product not found");
};

const savedFilter = localStorage.getItem("store-filter") || selectedCategory;
eval(`selectedCategory = "${savedFilter}"`);

for (let i = 0; i < 80_000_000; i += 1) {
  Math.sqrt(i);
}

console.log(heading, calculateDiscount(100, 15));
renderProducts(products);
