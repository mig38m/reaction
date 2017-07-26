import React, { Component } from "react";
import PropTypes from "prop-types";
import { Meteor } from "meteor/meteor";
import { composeWithTracker } from "/lib/api/compose";
import { Media } from "/lib/collections";
import { Reaction } from "/client/api";
import { Loading } from "/imports/plugins/core/ui/client/components";
import OrdersList from "../components/ordersList.js";
import {
  PACKAGE_NAME,
  ORDER_LIST_FILTERS_PREFERENCE_NAME,
  ORDER_LIST_SELECTED_ORDER_PREFERENCE_NAME
} from "../../lib/constants";


class OrdersListContainer extends Component {
  static propTypes = {
    handleShowMoreClick: PropTypes.func,
    hasMoreOrders: PropTypes.func,
    invoice: PropTypes.object,
    orders: PropTypes.array,
    uniqueItems: PropTypes.array
  }

  constructor(props) {
    super(props);

    this.state = {
      detailClassName: "",
      listClassName: "order-icon-toggle",
      openDetail: false,
      openList: true,
      selectedItems: [],
      orders: props.orders,
      hasMoreOrders: props.hasMoreOrders(),
      multipleSelect: false,
      packed: false,
      shipped: false
    };

    this.handleClick = this.handleClick.bind(this);
    this.handleListToggle = this.handleListToggle.bind(this);
    this.handleDetailToggle = this.handleDetailToggle.bind(this);
    this.handleDisplayMedia = this.handleDisplayMedia.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.selectAllOrders = this.selectAllOrders.bind(this);
    this.setShippingStatus = this.setShippingStatus.bind(this);
  }

  componentWillReceiveProps = (nextProps) => {
    this.setState({
      orders: nextProps.orders,
      hasMoreOrders: nextProps.hasMoreOrders()
    });
  }

  handleSelect = (event, isInputChecked, name) => {
    this.setState({
      multipleSelect: false
    });
    const selectedItemsArray = this.state.selectedItems;

    if (!selectedItemsArray.includes(name)) {
      selectedItemsArray.push(name);
      this.setState({
        selectedItems: selectedItemsArray
      });
    } else {
      const updatedSelectedArray = selectedItemsArray.filter((id) => {
        if (id !== name) {
          return id;
        }
      });
      this.setState({
        selectedItems: updatedSelectedArray
      });
    }
  }

  selectAllOrders = (orders, areAllSelected) => {
    if (areAllSelected) {
      // if all orders are selected, clear the selectedItems array
      // and set multipleSelect to false
      this.setState({
        selectedItems: [],
        multipleSelect: false
      });
    } else {
      // if there are no selected orders, or if there are some orders that have been
      // selected but not all of them, loop through the orders array and return a
      // new array with order ids only, then set the selectedItems array with the orderIds
      const orderIds = orders.map((order) => {
        return order._id;
      });
      this.setState({
        selectedItems: orderIds,
        multipleSelect: true
      });
    }
  }

  handleClick = (order, startWorkflow = false) => {
    Reaction.setActionViewDetail({
      label: "Order Details",
      i18nKeyLabel: "orderWorkflow.orderDetails",
      data: {
        order: order
      },
      props: {
        size: "large"
      },
      template: "coreOrderWorkflow"
    });

    if (startWorkflow === true) {
      Meteor.call("workflow/pushOrderWorkflow", "coreOrderWorkflow", "processing", order);
      Reaction.setUserPreferences(PACKAGE_NAME, ORDER_LIST_FILTERS_PREFERENCE_NAME, "processing");
    }

    Reaction.setUserPreferences(PACKAGE_NAME, ORDER_LIST_SELECTED_ORDER_PREFERENCE_NAME, order._id);
  }

  handleListToggle = () => {
    this.setState({
      detailClassName: "",
      listClassName: "order-icon-toggle",
      openList: true,
      openDetail: false
    });
  }

  handleDetailToggle = () => {
    this.setState({
      detailClassName: "order-icon-toggle",
      listClassName: "",
      openDetail: true,
      openList: false
    });
  }

  /**
   * Media - find media based on a product/variant
   * @param  {Object} item object containing a product and variant id
   * @return {Object|false} An object contianing the media or false
   */
  handleDisplayMedia = (item) => {
    const variantId = item.variants._id;
    const productId = item.productId;

    const variantImage = Media.findOne({
      "metadata.variantId": variantId,
      "metadata.productId": productId
    });

    if (variantImage) {
      return variantImage;
    }

    const defaultImage = Media.findOne({
      "metadata.productId": productId,
      "metadata.priority": 0
    });

    if (defaultImage) {
      return defaultImage;
    }
    return false;
  }

  setShippingStatus = (status, selectedOrdersIds) => {
    const selectedOrders = this.state.orders.filter((order) => {
      return selectedOrdersIds.includes(order._id);
    });

    if (status === "packed") {
      selectedOrders.forEach((order) => {
        if (order.shipping[0].packed === false) {
          Meteor.call("orders/shipmentPacked", order, order.shipping[0], true, (err) => {
            if (err) {
              Alerts.toast("Error", "error");
            } else {
              Alerts.toast(`Order with id ${order._id} shipping status set to packed`, "success");
            }

            this.setState({
              packed: true
            });
          });
        } else {
          Alerts.alert({
            text: "Order is already in the packed state"
          });
        }
      });
    }

    if (status === "shipped") {
      selectedOrders.forEach((order) => {
        if (order.shipping[0].packed && order.shipping[0].shipped === false) {
          Meteor.call("orders/shipmentShipped", order, order.shipping[0], (err) => {
            if (err) {
              Alerts.toast("Error", "error");
            } else {
              Alerts.toast(`Order with id ${order._id} shipping status set to shipped`, "success");
            }
            this.setState({
              shipped: true
            });
          });
        } else if (order.shipping[0].packed === false) {
          Alerts.alert({
            text: `You've requested that order ${order._id} be set to the "Shipped" status, but it is not in the "Packed"
                  state and would skip all steps leading up to the "Shipped" state. Are you sure you want to do this?`,
            type: "warning",
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: "Yes, Set All Selected Orders"
          }, (isConfirm) => {
            if (isConfirm) {
              Alerts.alert({
                title: "Set",
                type: "success"
              });
            }
          });
        } else {
          Alerts.alert({
            text: "Order is already in the shipped state"
          });
        }
      });
    }
  }

  render() {
    return (
      <OrdersList
        handleSelect={this.handleSelect}
        handleShowMoreClick={this.props.handleShowMoreClick}
        orders={this.state.orders}
        hasMoreOrders={this.state.hasMoreOrders}
        handleClick={this.handleClick}
        displayMedia={this.handleDisplayMedia}
        handleListToggle={this.handleListToggle}
        handleDetailToggle={this.handleDetailToggle}
        openDetail= {this.state.openDetail}
        selectedItems={this.state.selectedItems}
        openList={this.state.openList}
        selectAllOrders={this.selectAllOrders}
        multipleSelect={this.state.multipleSelect}
        listClassName={this.state.listClassName}
        detailClassName={this.state.detailClassName}
        setShippingStatus={this.setShippingStatus}
        shipped={this.state.shipped}
        packed={this.state.packed}
      />
    );
  }
}

const composer = (props, onData) => {
  const subscription = Meteor.subscribe("Media");
  if (subscription.ready()) {
    onData(null, {
      uniqueItems: props.items,
      invoice: props.invoice
    });
  }
};

export default composeWithTracker(composer, Loading)(OrdersListContainer);
